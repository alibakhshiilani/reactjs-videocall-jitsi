export const removeTrackFromDOM = (
  ref: any,
  participantId: string | undefined
) => {
  if (ref.current && participantId) {
    try {
      const audio = ref.current.querySelector(
        `audio[data-participant-id='${participantId}']`
      );
      audio !== null && ref.current.removeChild(audio);
      const video = ref.current.querySelector(
        `video[data-participant-id='${participantId}']`
      );
      video !== null && ref.current.removeChild(video);
    } catch {
      console.error("removeChild from reference failed ...");
    }
  }
};
