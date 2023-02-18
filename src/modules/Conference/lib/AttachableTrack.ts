import { Track } from "../conference.interface";

class AttachableTrack<E extends HTMLElement> {
  public _track: Track<E>;

  public _element: E;

  constructor(track: Track<E>, element: E) {
    this._track = track;
    this._element = element;
  }

  get track() {
    return this._track;
  }

  get element() {
    return this._element;
  }

  async attach(): Promise<any> {
    this._track.attach(this._element);
  }

  async dispose(): Promise<any> {
    this._track.detach(this._element);
    if (this._track.isLocal()) {
      return await this._track.dispose();
    }
  }
}

export default AttachableTrack;
