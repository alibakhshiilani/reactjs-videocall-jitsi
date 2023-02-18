export interface localTracksInterface {
  audio: HTMLAudioElement | undefined;
  video: HTMLVideoElement | undefined;
  member: any;
}

export interface remoteTracksInterface {
  [key: string]: {
    audio: HTMLAudioElement | undefined;
    video: HTMLVideoElement | undefined;
    member: any;
  };
}

export enum TrackersTypeEnum {
  LOCAl = "LOCAl",
  REMOTE = "REMOTE",
}

export enum CallTypesEnum {
  VIDEO = "VIDEO",
  VOICE = "VOICE",
}

export interface ChatUrlParamInterface {
  type: any;
  id: string;
}

export interface CallUrlParamInterface {
  type: CallTypesEnum;
  id: string;
}
