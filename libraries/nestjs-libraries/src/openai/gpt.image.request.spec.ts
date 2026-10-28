import { gptImageGenerationRequest } from '@gitroom/nestjs-libraries/openai/openai.service';

describe('gptImageGenerationRequest', () => {
  it('omits response_format for chatgpt-image-latest', () => {
    const square = gptImageGenerationRequest('a red bicycle');
    const vertical = gptImageGenerationRequest('a tall poster', true);

    expect(square).toEqual({
      prompt: 'a red bicycle',
      model: 'chatgpt-image-latest',
      size: '1024x1024',
    });
    expect(vertical).toEqual({
      prompt: 'a tall poster',
      model: 'chatgpt-image-latest',
      size: '1024x1536',
    });

    for (const request of [square, vertical]) {
      expect(Object.keys(request).sort()).toEqual(['model', 'prompt', 'size']);
      expect(request).not.toHaveProperty('response_format');
      expect(request).not.toHaveProperty('style');
      expect(request).not.toHaveProperty('quality');
    }
  });
});
