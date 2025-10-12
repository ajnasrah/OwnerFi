export interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  gender: string;
  preview_image_url: string;
  preview_video_url: string;
  premium: boolean;
}

export interface HeyGenTalkingPhoto {
  talking_photo_id: string;
  talking_photo_name: string;
  preview_image_url: string;
}

export interface HeyGenVoice {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
  preview_audio?: string | null;
  support_pause?: boolean;
  emotion_support?: boolean;
  support_interactive_avatar?: boolean;
  support_locale?: boolean;
}

export interface HeyGenAvatarsResponse {
  success: boolean;
  avatars: HeyGenAvatar[];
  talking_photos: HeyGenTalkingPhoto[];
}

export interface HeyGenVoicesResponse {
  success: boolean;
  voices: HeyGenVoice[];
}
