import { TrackType } from "./conference.constants";

export interface Track<E extends HTMLElement> {
  isLocal(): boolean;
  getId(): string;
  getParticipantId(): string;
  getType(): TrackType;
  attach(element: E): any;
  detach(element: E): any;
  dispose(): Promise<any>;
  mute(): any;
  unmute(): any;
  isMuted(): boolean;
  addEventListener(event: any, callback: any);
}

export interface Member {
  uuid: string;
  nickname: string;
}
