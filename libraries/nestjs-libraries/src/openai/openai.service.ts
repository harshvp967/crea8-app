import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { shuffle } from 'lodash';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-proj-',
});

function stalkerOpenAiModel() {
  const configured = process.env.STALKER_OPENAI_MODEL?.trim();
  return configured || 'gpt-4o-mini';
}

const PicturePrompt = z.object({
  prompt: z.string(),
});

const VoicePrompt = z.object({
  voice: z.string(),
});

const ClipsPrompt = z.object({
  clips: z.array(
    z.object({
      from: z.number().describe('Number of the first line of the clip'),
      to: z.number().describe('Number of the last line of the clip'),
      title: z.string().describe('Short title of the clip'),
      content: z
        .string()
        .describe('Social media post to publish the clip with, no hashtags'),
    })
  ),
});

@Injectable()
export class OpenaiService {
  // The model answers with line numbers and not times, so a clip can only
  // start and end where the transcript really has a boundary
  async pickClips(
    title: string,
    language: string,
    segments: { start: number; end: number; text: string }[],
    maxClips: number
  ) {
    const { clips } = (
      await openai.chat.completions.parse(
        {
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that takes the transcript of a video and picks the parts that will work best as short vertical clips for social media.
Every line of the transcript is "number [start seconds - end seconds] text".
Pick up to ${maxClips} clips, best first. A clip is a range of consecutive lines that starts with a hook, makes one complete point and is understandable without the rest of the video.
The length of a clip is the end of its last line minus the start of its first line: it must be between 20 and 90 seconds, never longer, so check the numbers before answering.
Clips must not overlap. Write the title and the post in this language, whatever the language of these instructions: ${language}.`,
            },
            {
              role: 'user',
              content: `title: ${title}\n\n${segments
                .map(
                  (p, index) =>
                    `${index} [${p.start.toFixed(1)} - ${p.end.toFixed(1)}] ${
                      p.text
                    }`
                )
                .join('\n')}`,
            },
          ],
          response_format: zodResponseFormat(ClipsPrompt, 'clipsPrompt'),
        },
        // shorter than the activity: an attempt that was given up on must not
        // still be running, and storing clips, when its retry gets there
        { timeout: 8 * 60 * 1000, maxRetries: 0 }
      )
    ).choices[0].message.parsed || { clips: [] };

    return clips;
  }

  async generateImage(prompt: string, isVertical = false) {
    // gpt-image models always return base64 (b64_json) and do not accept the
    // `response_format` parameter, unlike the deprecated dall-e-3.
    const generate = (
      await openai.images.generate({
        prompt,
        model: 'chatgpt-image-latest',
        size: isVertical ? '1024x1536' : '1024x1024',
      })
    ).data[0];

    return generate.b64_json;
  }

  async generatePromptForPicture(prompt: string) {
    return (
      (
        await openai.chat.completions.parse({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that take a description and style and generate a prompt that will be used later to generate images, make it a very long and descriptive explanation, and write a lot of things for the renderer like, if it${"'"}s realistic describe the camera`,
            },
            {
              role: 'user',
              content: `prompt: ${prompt}`,
            },
          ],
          response_format: zodResponseFormat(PicturePrompt, 'picturePrompt'),
        })
      ).choices[0].message.parsed?.prompt || ''
    );
  }

  async generateVoiceFromText(prompt: string) {
    return (
      (
        await openai.chat.completions.parse({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that takes a social media post and convert it to a normal human voice, to be later added to a character, when a person talk they don\'t use "-", and sometimes they add pause with "..." to make it sounds more natural, make sure you use a lot of pauses and make it sound like a real person`,
            },
            {
              role: 'user',
              content: `prompt: ${prompt}`,
            },
          ],
          response_format: zodResponseFormat(VoicePrompt, 'voice'),
        })
      ).choices[0].message.parsed?.voice || ''
    );
  }

  async generatePosts(content: string) {
    const posts = (
      await Promise.all([
        openai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
              content:
                'Generate a Twitter post from the content without emojis in the following JSON format: { "post": string } put it in an array with one element',
            },
            {
              role: 'user',
              content: content!,
            },
          ],
          n: 5,
          temperature: 1,
          model: 'gpt-4.1',
        }),
        openai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
              content:
                'Generate a thread for social media in the following JSON format: Array<{ "post": string }> without emojis',
            },
            {
              role: 'user',
              content: content!,
            },
          ],
          n: 5,
          temperature: 1,
          model: 'gpt-4.1',
        }),
      ])
    ).flatMap((p) => p.choices);

    return shuffle(
      posts.map((choice) => {
        const { content } = choice.message;
        const start = content?.indexOf('[')!;
        const end = content?.lastIndexOf(']')!;
        try {
          return JSON.parse(
            '[' +
              content
                ?.slice(start + 1, end)
                .replace(/\n/g, ' ')
                .replace(/ {2,}/g, ' ') +
              ']'
          );
        } catch (e) {
          return [];
        }
      })
    );
  }
  async extractWebsiteText(content: string) {
    const websiteContent = await openai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content:
            'You take a full website text, and extract only the article content',
        },
        {
          role: 'user',
          content,
        },
      ],
      model: 'gpt-4.1',
    });

    const { content: articleContent } = websiteContent.choices[0].message;

    return this.generatePosts(articleContent!);
  }

  async separatePosts(content: string, len: number) {
    const SeparatePostsPrompt = z.object({
      posts: z.array(z.string()),
    });

    const SeparatePostPrompt = z.object({
      post: z.string().max(len),
    });

    const posts =
      (
        await openai.chat.completions.parse({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that take a social media post and break it to a thread, each post must be minimum ${
                len - 10
              } and maximum ${len} characters, keeping the exact wording and break lines, however make sure you split posts based on context`,
            },
            {
              role: 'user',
              content: content,
            },
          ],
          response_format: zodResponseFormat(
            SeparatePostsPrompt,
            'separatePosts'
          ),
        })
      ).choices[0].message.parsed?.posts || [];

    return {
      posts: await Promise.all(
        posts.map(async (post: any) => {
          if (post.length <= len) {
            return post;
          }

          let retries = 4;
          while (retries) {
            try {
              return (
                (
                  await openai.chat.completions.parse({
                    model: 'gpt-4.1',
                    messages: [
                      {
                        role: 'system',
                        content: `You are an assistant that take a social media post and shrink it to be maximum ${len} characters, keeping the exact wording and break lines`,
                      },
                      {
                        role: 'user',
                        content: post,
                      },
                    ],
                    response_format: zodResponseFormat(
                      SeparatePostPrompt,
                      'separatePost'
                    ),
                  })
                ).choices[0].message.parsed?.post || ''
              );
            } catch (e) {
              retries--;
            }
          }

          return post;
        })
      ),
    };
  }

  async generateSlidesFromText(text: string) {
    for (let i = 0; i < 3; i++) {
      try {
        const message = `You are an assistant that takes a text and break it into slides, each slide should have an image prompt and voice text to be later used to generate a video and voice, image prompt should capture the essence of the slide and also have a back dark gradient on top, image prompt should not contain text in the picture, generate between 3-5 slides maximum`;
        const parse =
          (
            await openai.chat.completions.parse({
              model: 'gpt-4.1',
              messages: [
                {
                  role: 'system',
                  content: message,
                },
                {
                  role: 'user',
                  content: text,
                },
              ],
              response_format: zodResponseFormat(
                z.object({
                  slides: z
                    .array(
                      z.object({
                        imagePrompt: z.string(),
                        voiceText: z.string(),
                      })
                    )
                    .describe('an array of slides'),
                }),
                'slides'
              ),
            })
          ).choices[0].message.parsed?.slides || [];

        return parse;
      } catch (err) {
        console.log(err);
      }
    }

    return [];
  }

  hasApiKey() {
    return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-proj-';
  }

  async classifyStalkerMentions(
    items: { id: string; text: string }[],
    categories: { name: string; description: string }[],
    brand: { name: string; aliases: string; description: string }
  ): Promise<
    {
      id: string;
      categoryName: string;
      sentiment: string;
      urgency: number;
      relevant: boolean;
    }[]
  > {
    if (!this.hasApiKey() || !items.length || !categories.length) {
      return [];
    }

    const allowed = categories
      .map(
        (category) =>
          `- ${category.name}: ${category.description || 'No description'}`
      )
      .join('\n');
    const parsed = (
      await openai.chat.completions.parse({
        model: stalkerOpenAiModel(),
        messages: [
          {
            role: 'system',
            content: `You screen social mentions for one brand, then classify the ones that are about it.

Brand: ${brand.name || 'Unknown'}
Aliases: ${brand.aliases || 'none'}
Description: ${brand.description || 'none'}

relevant is false ONLY for clear spam, scams, bot output, gibberish, or empty noise with no real content. Never mark a mention irrelevant because it is about a different product, a competitor, or another topic: the user tracks those keywords on purpose. When unsure, relevant is true.

Classify each relevant mention into exactly one category below. categoryName must be copied from that list. If relevant is false, still copy a category name from the list (the first one is fine). sentiment is POSITIVE, NEGATIVE, or NEUTRAL. urgency is 0-100, and higher when the mention is a bug, complaint, or needs a response soon. Return every id you were given. Do not invent mentions.

${allowed}`,
          },
          {
            role: 'user',
            content: JSON.stringify(
              items.map((item) => ({
                id: item.id,
                text: item.text.slice(0, 500),
              }))
            ),
          },
        ],
        response_format: zodResponseFormat(
          z.object({
            items: z.array(
              z.object({
                id: z.string(),
                categoryName: z.string(),
                sentiment: z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL']),
                urgency: z.number(),
                relevant: z.boolean(),
              })
            ),
          }),
          'stalkerMentions'
        ),
      })
    ).choices[0].message.parsed;

    return (parsed?.items || []).flatMap((item) =>
      item.id &&
      item.categoryName &&
      item.sentiment &&
      typeof item.urgency === 'number' &&
      typeof item.relevant === 'boolean'
        ? [
            {
              id: item.id,
              categoryName: item.categoryName,
              sentiment: item.sentiment,
              urgency: item.urgency,
              relevant: item.relevant,
            },
          ]
        : []
    );
  }

  async clusterStalkerThemes(
    items: { id: string; text: string; category: string }[]
  ): Promise<{ title: string; summary: string; mentionIds: string[] }[]> {
    if (!this.hasApiKey() || items.length < 2) {
      return [];
    }

    const parsed = (
      await openai.chat.completions.parse({
        model: stalkerOpenAiModel(),
        messages: [
          {
            role: 'system',
            content:
              'Group recurring social mentions into at most 8 themes. Each theme needs a short title like "12 people asked for a tutorial on X", a one-sentence summary, and the mention ids that belong to it. Skip spam. Only use ids from the input. A mention can belong to one theme.',
          },
          {
            role: 'user',
            content: JSON.stringify(
              items.map((item) => ({
                id: item.id,
                category: item.category,
                text: item.text.slice(0, 280),
              }))
            ),
          },
        ],
        response_format: zodResponseFormat(
          z.object({
            themes: z.array(
              z.object({
                title: z.string(),
                summary: z.string(),
                mentionIds: z.array(z.string()),
              })
            ),
          }),
          'stalkerThemes'
        ),
      })
    ).choices[0].message.parsed;

    return (parsed?.themes || []).flatMap((theme) =>
      theme.title && theme.summary && theme.mentionIds
        ? [
            {
              title: theme.title,
              summary: theme.summary,
              mentionIds: theme.mentionIds,
            },
          ]
        : []
    );
  }

  async draftStalkerPost(input: {
    mode: 'post' | 'quote';
    title: string;
    body: string;
  }): Promise<string> {
    if (!this.hasApiKey()) {
      return '';
    }

    const parsed = (
      await openai.chat.completions.parse({
        model: stalkerOpenAiModel(),
        messages: [
          {
            role: 'system',
            content:
              input.mode === 'quote'
                ? 'Write a short social post that quotes the testimonial. Use only the words in the source. Do not invent names, numbers, or claims. No hashtags.'
                : 'Write a short social post a brand could publish from this audience signal. Use only what the source says. Do not invent names, numbers, or claims. No hashtags.',
          },
          {
            role: 'user',
            content: `Title: ${input.title}\n\n${input.body.slice(0, 2000)}`,
          },
        ],
        response_format: zodResponseFormat(
          z.object({
            content: z.string(),
          }),
          'stalkerDraft'
        ),
      })
    ).choices[0].message.parsed;

    return parsed?.content || '';
  }
}
