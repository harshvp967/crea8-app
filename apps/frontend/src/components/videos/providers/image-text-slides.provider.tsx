import { videoWrapper } from '@gitroom/frontend/components/videos/video.wrapper';
import { FC, useCallback, useRef, useState, useEffect } from 'react';
import { useVideoFunction } from '@gitroom/frontend/components/videos/video.render.component';
import useSWR from 'swr';
import { useFormContext } from 'react-hook-form';
import { Button } from '@gitroom/react/form/button';
import clsx from 'clsx';
import { useVideo } from '@gitroom/frontend/components/videos/video.context.wrapper';
import { Skeleton } from '@gitroom/frontend/components/ui/skeleton';

export interface Voices {
  voices: Voice[];
}

export interface Voice {
  id: string;
  name: string;
  preview_url: string;
}

const VoiceSelector: FC = () => {
  const { register, watch, setValue } = useFormContext();
  const videoFunction = useVideoFunction();
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { value } = useVideo();

  register('prompt', {
    value,
  });

  const loadVideos = useCallback(() => {
    return videoFunction('loadVoices', {});
  }, []);

  const selectedVoice = watch('voice');
  const { isLoading, data } = useSWR<Voices>('load-voices', loadVideos);

  // Auto-select first voice when data loads
  useEffect(() => {
    if (data?.voices?.length && !selectedVoice) {
      setValue('voice', data.voices[0].id);
    }
  }, [data, selectedVoice, setValue]);

  const playVoice = useCallback(
    async (voiceId: string, previewUrl: string) => {
      try {
        setLoadingVoice(voiceId);

        // Stop current audio if playing
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        // If clicking the same voice that's playing, stop it
        if (currentlyPlaying === voiceId) {
          setCurrentlyPlaying(null);
          setLoadingVoice(null);
          return;
        }

        // Create new audio element
        const audio = new Audio(previewUrl);
        audioRef.current = audio;

        audio.addEventListener('loadeddata', () => {
          setLoadingVoice(null);
          setCurrentlyPlaying(voiceId);
        });

        audio.addEventListener('ended', () => {
          setCurrentlyPlaying(null);
          audioRef.current = null;
        });

        audio.addEventListener('error', () => {
          setLoadingVoice(null);
          setCurrentlyPlaying(null);
          audioRef.current = null;
        });

        await audio.play();
      } catch (error) {
        console.error('Error playing voice:', error);
        setLoadingVoice(null);
        setCurrentlyPlaying(null);
      }
    },
    [currentlyPlaying]
  );

  const selectVoice = useCallback(
    (voiceId: string) => {
      setValue('voice', voiceId);
    },
    [setValue]
  );

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-[8px]" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton className="h-[44px] w-full rounded-[12px]" key={index} />
        ))}
      </div>
    );
  }
  if (!data.voices?.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-textColor mb-4">
        Select a Voice
      </div>
      <div className="space-y-2">
        {data.voices.map((voice) => (
          <div
            key={voice.id}
            className={clsx(
              'flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer',
              selectedVoice === voice.id
                ? 'border-primary bg-primary/10'
                : 'border-tableBorder bg-sixth hover:bg-seventh'
            )}
            onClick={() => selectVoice(voice.id)}
          >
            <div className="flex items-center space-x-3">
              <input
                {...register('voice')}
                type="radio"
                value={voice.id}
                className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                checked={selectedVoice === voice.id}
                onChange={() => selectVoice(voice.id)}
              />
              <div>
                <div className="text-sm font-medium text-textColor">
                  {voice.name}
                </div>
              </div>
            </div>

            <Button
              type="button"
              className={clsx(
                'px-3 py-1 text-xs',
                loadingVoice === voice.id && 'opacity-50 cursor-not-allowed',
                currentlyPlaying === voice.id && 'bg-red-500 hover:bg-red-600'
              )}
              onClick={(e) => {
                e.stopPropagation();
                playVoice(voice.id, voice.preview_url);
              }}
              disabled={loadingVoice === voice.id}
            >
              {loadingVoice === voice.id
                ? '...'
                : currentlyPlaying === voice.id
                ? '⏹ Stop'
                : '▶ Play'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

const ImageSlidesComponent = () => {
  return <VoiceSelector />;
};

videoWrapper('image-text-slides', ImageSlidesComponent);
