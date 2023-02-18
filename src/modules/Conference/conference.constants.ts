import { confOptions, jitsiOptions } from "./conference.config";

export enum TrackType {
  AUDIO = "audio",
  VIDEO = "video",
}
export const inBrowser = true;

export const OPTIONS = {
  JITSI: {},

  CONNECTION: jitsiOptions,

  CONFERENCE: confOptions,

  TRACKS: ((supportedConstraints) => ({
    devices: ["audio", "video"],
    resolution: 640,
    minFps: 24,
    maxFps: 24,
    facingMode: "user",
    constraints: {
      video: {
        facingMode: supportedConstraints.facingMode
          ? { ideal: "user" }
          : undefined,
        width: supportedConstraints.width ? { ideal: 640 } : undefined, // vga
        height: supportedConstraints.height ? { ideal: 480 } : undefined, // vga
        frameRate: supportedConstraints.frameRate ? 24 : undefined,
        // resizeMode: supportedConstraints.resizeMode
        //   ? "crop-and-scale"
        //   : undefined,
      },
    },
  }))(
    (inBrowser &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getSupportedConstraints()) ||
      {}
  ),
};
