import { Member, Track } from "./conference.interface";
import { inBrowser, OPTIONS } from "./conference.constants";
import AttachableTrack from "./lib/AttachableTrack";
import { serviceUrl } from "./conference.config";

const noop = () => {};

const JitsiMeetJS = inBrowser && (window as any).JitsiMeetJS;

if (JitsiMeetJS) {
  JitsiMeetJS.setLogLevel(JitsiMeetJS.logLevels.ERROR);
  JitsiMeetJS.init(OPTIONS.JITSI);
}

export class Conference {
  private _room: string | undefined;

  private _member: Member | undefined;

  private _connection: any;

  private _conference: any;

  private _localVideo: AttachableTrack<HTMLVideoElement> | undefined;

  private _localAudio: AttachableTrack<HTMLAudioElement> | undefined;

  private _audiosByParticipantId: Map<
    string,
    AttachableTrack<HTMLAudioElement>
  > = new Map();

  private _videosByParticipantId: Map<
    string,
    AttachableTrack<HTMLVideoElement>
  > = new Map();

  private _membersByParticipantId: Map<string, Member> = new Map();

  private _onLocalJoined: (
    audio: HTMLAudioElement,
    video: HTMLVideoElement,
    member: Member
  ) => any = noop;

  private _onRemoteJoined: (
    audio: HTMLAudioElement,
    video: HTMLVideoElement,
    member: Member
  ) => any = noop;

  private _onTrackAudioLevelChanged: (
    participantId: string,
    audioLevel: number
  ) => any = noop;

  private _onTrackMuteChanged: (track: any) => any = noop;

  private _onRemoteLeft: (member: Member, participantId?: string) => any = noop;

  private _onError: (error: any) => any = noop;

  constructor() {
    this._quitOnUnload();
  }

  onLocalJoined(
    onLocalJoined: (
      audio: HTMLAudioElement,
      video: HTMLVideoElement,
      member: Member
    ) => any
  ) {
    this._onLocalJoined = onLocalJoined;
    return this;
  }

  onRemoteJoined(
    onRemoteJoined: (
      audio: HTMLAudioElement,
      video: HTMLVideoElement,
      member: Member
    ) => any
  ) {
    this._onRemoteJoined = onRemoteJoined;
    return this;
  }

  private async _joinConference() {
    this._conference = this._connection.initJitsiConference(
      this._room,
      OPTIONS.CONFERENCE
    );
    this._conference.on(
      JitsiMeetJS.events.conference.CONFERENCE_JOINED,
      async () => await this._onConferenceJoined()
    );
    this._conference.on(
      JitsiMeetJS.events.conference.CONFERENCE_FAILED,
      async (...args: any) => await this._onConferenceFailed(...args)
    );
    this._conference.on(
      JitsiMeetJS.events.conference.USER_JOINED,
      async (participantId: any, participant: any) =>
        await this._onParticipantJoined(participantId, participant)
    );
    this._conference.on(
      JitsiMeetJS.events.conference.DISPLAY_NAME_CHANGED,
      async (participantId: any, displayName: any) =>
        await this._onParticipantDisplayNameChanged(participantId, displayName)
    );
    this._conference.on(
      JitsiMeetJS.events.conference.TRACK_ADDED,
      async (track: any) => await this._onRemoteTrack(track)
    );
    this._conference.on(
      JitsiMeetJS.events.conference.TRACK_MUTE_CHANGED,
      async (track: any) => {
        console.log("xxx", track);
        this._JitsiStatusLogger('Someon changed his/her mute status')
        return await this._onTrackMuteChanged(track);
      }
    );
    this._conference.on(
      JitsiMeetJS.events.conference.TRACK_REMOVED,
      async (track: any) => await this._onRemoteTrackRemoved(track)
    );
    this._conference.on(
      JitsiMeetJS.events.conference.USER_LEFT,
      async (participantId: any) => await this._onParticipantLeft(participantId)
    );
    this._conference.on(
      JitsiMeetJS.events.conference.TRACK_AUDIO_LEVEL_CHANGED,
      async (participantId: string, audioLevel: number) =>
        await this._onTrackAudioLevelChanged(participantId, audioLevel)
    );
    this._conference.join();
  }

  onRemoteLeft(onRemoteLeft: (member: Member, participantId?: string) => any) {
    this._JitsiStatusLogger('Some remote left the confrence ! -> delete video and audio')
    this._onRemoteLeft = onRemoteLeft;
    return this;
  }

  onError(onError: (error: string) => any) {
    this._onError = onError;
    return this;
  }

  join(
    room: string,
    memberUuid: string,
    memberNickname: string,
    memberPassword: string
  ) {
    console.log("Conference - Connecting");
    this._prepareConnection();
    this._room = room.toLowerCase();
    this._member = { uuid: memberUuid, nickname: memberNickname };
    this._connection.connect({
      id: `${memberUuid}@${serviceUrl}`,
      password: memberPassword,
    });
    return this;
  }

  muteVideoTrack(mute: boolean = true) {
    this._JitsiStatusLogger('muteVideoTrack')

    if (this._localVideo && this._localVideo._track) {
      console.warn("this._localVideo", this._localVideo._track || "");
    }
    if (this._localVideo) {
      console.warn("Conference - muteVideoTrack - local only", mute, this);
      mute ? this._localVideo._track.mute() : this._localVideo._track.unmute();
    }
    return this;
  }

  muteAudioTrack(mute: boolean = true) {
    this._JitsiStatusLogger('muteAudioTrack')

    if (this._localAudio) {
      console.warn("Conference - muteAudioTrack - local only", mute);
      mute ? this._localAudio._track.mute() : this._localAudio._track.unmute();
    }
    return this;
  }

  async quit(error?: string) {
    if (error) {
      console.error(
        `Conference - An error occurred that triggered quitting the conference: ${error}`
      );
    } else if (this._connection) {
      console.log("Conference - Quitting conference");
    } else {
      return;
    }
    const { _onError } = this;
    this._onLocalJoined = noop;
    this._onTrackAudioLevelChanged = noop;
    this._onTrackMuteChanged = noop;
    this._onRemoteJoined = noop;
    this._onRemoteLeft = noop;
    this._onError = noop;
    try {
      (await this._conference) && this._conference.leave();
      const remoteAudioPromises = Array.from(
        this._audiosByParticipantId.values()
      ).map((track) => track.dispose());
      const remoteVideoPromises = Array.from(
        this._videosByParticipantId.values()
      ).map((track) => track.dispose());
      await Promise.all([
        ...remoteAudioPromises,
        ...remoteVideoPromises,
        this._localVideo && this._localVideo.dispose(),
        this._localAudio && this._localAudio.dispose(),
        this._connection && this._connection.disconnect(),
      ]);
    } catch (e) {
      console.error("Conference - Unable to quit conference gracefully", e);
    }
    if (error) {
      await _onError(error);
    }
    this._room = undefined;
    // this._member = undefined;
    this._connection = undefined;
    this._conference = undefined;
    // this._localAudio = undefined;
    // this._localVideo = undefined;
    this._audiosByParticipantId.clear();
    this._videosByParticipantId.clear();
    this._membersByParticipantId.clear();
  }

  private _quitOnUnload() {
    if (inBrowser) {
      window.addEventListener("beforeunload", async () => {
        await this.quit();
      });
    }
  }

  private _prepareConnection() {
    if (!JitsiMeetJS) {
      throw new Error("JitsiMeetJS is undefined");
    }
    this._connection = new JitsiMeetJS.JitsiConnection(
      null,
      null,
      OPTIONS.CONNECTION
    );
    this._connection.addEventListener(
      JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED,
      async () => await this._onConnectionEstablished()
    );
    this._connection.addEventListener(
      JitsiMeetJS.events.connection.CONNECTION_FAILED,
      async (...args: any) => await this._onConnectionFailed(args)
    );
  }

  private async _onConnectionEstablished() {
    try {
      console.log("Conference - Connection established");
      this._JitsiStatusLogger('Connection Established successfully 🎉' )
      await this._createLocalTracks();
    } catch (e) {
      console.error("Conference - Unable to create local tracks", e);
      this._JitsiStatusLogger('Error occured in establishing connection or further steps' )
      await this.quit("local_tracks");
    }
  }

  private async _createLocalTracks() {

try {
  
  const localTracks: [Track<any>] = await JitsiMeetJS.createLocalTracks(
    OPTIONS.TRACKS
  );
  await Promise.all(localTracks.map((track) => this._onLocalTrack(track)));
  this._JitsiStatusLogger('_createLocalTracks success' )

} catch (error) {
  this._JitsiStatusLogger('create Local Tracks failed - error :',error )
  
}

  }

  private async _onLocalTrack(track: Track<any>) {
    if (!track.isLocal()) {
      console.warn("Conference - Track was supposed to be local");
      return;
    }
    this._JitsiStatusLogger('_onLocalTrack method called' )

    switch (track.getType()) {
      case "audio":
        await this._onLocalAudioTrack(track);
        break;
      case "video":
        await this._onLocalVideoTrack(track);
        break;
      default:
        console.error(`Conference - Unexpected track type: ${track.getType()}`);
        break;
    }
  }

  private async _onLocalAudioTrack(track: Track<HTMLAudioElement>) {
    if (this._localAudio) {
      console.warn("Conference - Local audio already set");
      return;
    }
    this._JitsiStatusLogger('_onLocalAudioTrack method called' )

    console.log("Conference - Creating local audio");
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.muted = true;
    audio.setAttribute("id", track.getId());
    audio.setAttribute(
      "dashboardMenuUtils-participant-id",
      track.getParticipantId()
    );
    // @ts-ignore
    audio.setAttribute("dashboardMenuUtils-member-uuid", this._member.uuid);
    const attachableTrack = new AttachableTrack<HTMLAudioElement>(track, audio);
    audio.onloadeddata = async () => {
      audio.onloadeddata = noop;
      if (this._localAudio) {
        console.error("Conference - Race condition with local audio", track);
      } else {
        this._JitsiStatusLogger("Local audio loaded");
        this._localAudio = attachableTrack;
        await this._notifyLocalJoined();
      }
    };
    await attachableTrack.attach();
  }

  private async _onLocalVideoTrack(track: Track<HTMLVideoElement>) {
    if (this._localVideo) {
      console.warn("Conference - Local video already set");
      return;
    }
    this._JitsiStatusLogger('_onLocalVideoTrack method called' )

    console.log("Conference - Creating local video");
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("id", track.getId());
    video.setAttribute(
      "dashboardMenuUtils-participant-id",
      track.getParticipantId()
    );
    // @ts-ignore
    video.setAttribute("dashboardMenuUtils-member-uuid", this._member.uuid);
    const attachableTrack = new AttachableTrack<HTMLVideoElement>(track, video);
    video.onloadeddata = async () => {
      video.onloadeddata = noop;
      if (this._localVideo) {
        console.error("Conference - Race condition with local video", track);
      } else {
        console.log("Conference - Local video loaded");
        this._localVideo = attachableTrack;
        await this._notifyLocalJoined();
      }
    };
    await attachableTrack.attach();
  }

  private async _notifyLocalJoined() {
    const shouldNotify = this._localAudio && this._localVideo;
    if (shouldNotify) {
      console.log("Conference - Local ready, joining conference");
      // @ts-ignore
      await Promise.all([
        // @ts-ignore
        this._onLocalJoined(
          // @ts-ignore
          this._localAudio.element,
          // @ts-ignore
          this._localVideo.element,
          // @ts-ignore
          this._member
        ),
        this._joinConference(),
      ]);
    }
  }

  private async _onConferenceJoined() {
    this._JitsiStatusLogger('Jitsi initializes successfully -> create local and remote tracks')
    console.log(
      "Conference - Conference joined, setting display name and adding local tracks"
    );
    this._setDisplayName();
    await Promise.all([
      // @ts-ignore
      this._conference.addTrack(this._localAudio.track),
      // @ts-ignore
      this._conference.addTrack(this._localVideo.track),
    ]);
  }

  private _setDisplayName() {
    const displayName = this._member?.nickname || "PWA User";
    this._conference.setDisplayName(displayName);
  }

  private async _onRemoteTrack(track: Track<any>) {
    
    if (track.isLocal()) {
      console.warn("Conference - Track was supposed to be remote");
      return;
    }
    this._JitsiStatusLogger('_onRemoteTrack method called - remote tracker joined -> create video and audio stream connection' )
    switch (track.getType()) {
      case "audio":
        await this._onRemoteAudioTrack(track);
        break;
      case "video":
        await this._onRemoteVideoTrack(track);
        break;
      default:
        console.error(`Conference - Unexpected track type: ${track.getType()}`);
        break;
    }
  }

  private async _onRemoteTrackRemoved(track: Track<any>) {
    this._JitsiStatusLogger('_onRemoteTrackRemoved method called' )
    this._JitsiStatusLogger('Removing one remote tracker')

    if (track.isLocal()) {
      console.warn("Conference - Track was supposed to be remote");
      return;
    }

    const participantId: string | undefined = track.getParticipantId();
    console.warn("participantId", participantId);

    if (participantId) {
      const promises = [];
      if (this._videosByParticipantId.has(participantId)) {
        console.warn("participantId1", participantId);
        const track: any = this._videosByParticipantId.get(participantId);
        this._videosByParticipantId.delete(participantId);
        promises.push(track.dispose());
      }
      if (this._audiosByParticipantId.has(participantId)) {
        console.warn("participantId2", participantId);
        const track: any = this._audiosByParticipantId.get(participantId);
        this._audiosByParticipantId.delete(participantId);
        promises.push(track.dispose());
      }
      if (this._membersByParticipantId.has(participantId)) {
        console.warn("participantId3", participantId);
        const member: any = this._membersByParticipantId.get(participantId);
        this._membersByParticipantId.delete(participantId);
        if (promises.length === 2) {
          this._JitsiStatusLogger('_onRemoteLeft')
          promises. push(this._onRemoteLeft(member, participantId));
        }
      }
      if (promises.length === 3) {
        console.log("Conference - Track Removed");
      }
    }
  }

  private async _onRemoteAudioTrack(track: Track<HTMLAudioElement>) {
    this._JitsiStatusLogger('_onRemoteAudioTrack method called' )
    const participantId = track.getParticipantId();
    const audioAlreadySet = this._audiosByParticipantId.has(participantId);
    let audio: HTMLAudioElement | undefined;
    if (audioAlreadySet) {
      console.log("Conference - Replacing remote audio");
      const attachedTrack: any = this._audiosByParticipantId.get(participantId);
      audio = attachedTrack.element;
      await attachedTrack.dispose();
    } else {
      console.log("Conference - Creating remote audio");
      audio = document.createElement("audio");
      audio.autoplay = true;
    }
    if (audio) {
      audio.setAttribute("id", track.getId());
      audio.setAttribute("dashboardMenuUtils-participant-id", participantId);
    }
    if (this._membersByParticipantId.has(participantId) && audio) {
      // @ts-ignore
      audio.setAttribute(
        "dashboardMenuUtils-member-uuid",
        // @ts-ignore
        this._membersByParticipantId.get(participantId).uuid
      );
    }
    // @ts-ignore
    const attachableTrack = new AttachableTrack<HTMLAudioElement>(track, audio);
    if (audioAlreadySet) {
      this._audiosByParticipantId.set(participantId, attachableTrack);
    } else if (audio) {
      audio.onloadeddata = async () => {
        // @ts-ignore
        audio.onloadeddata = noop;
        if (this._audiosByParticipantId.has(participantId)) {
          console.error(
            "Conference - Race condition with remote audio track",
            track
          );
        } else {
          console.log("Conference - Remote audio loaded");
          this._audiosByParticipantId.set(participantId, attachableTrack);
          await this._notifyRemoteJoined(participantId);
        }
      };
    }
    await attachableTrack.attach();
  }

  private async _onRemoteVideoTrack(track: Track<HTMLVideoElement>) {
    this._JitsiStatusLogger('_onRemoteVideoTrack method called' )

    const participantId = track.getParticipantId();
    const videoAlreadySet = this._videosByParticipantId.has(participantId);
    let video: HTMLVideoElement | undefined;
    if (videoAlreadySet) {
      console.log("Conference - Replacing remote video");
      const attachedTrack: any = this._videosByParticipantId.get(participantId);
      video = attachedTrack.element;
      await attachedTrack.dispose();
    } else {
      console.log("Conference - Creating remote video");
      video = document.createElement("video");
      video.autoplay = true;
      video.setAttribute("playsinline", "");
    }
    if (video) {
      video.setAttribute("id", track.getId());
      video.setAttribute("dashboardMenuUtils-participant-id", participantId);
      if (this._membersByParticipantId.has(participantId)) {
        // @ts-ignore
        video.setAttribute(
          "dashboardMenuUtils-member-uuid",
          // @ts-ignore
          this._membersByParticipantId.get(participantId).uuid
        );
      }
      const attachableTrack = new AttachableTrack<HTMLVideoElement>(
        track,
        video
      );
      if (videoAlreadySet) {
        this._videosByParticipantId.set(participantId, attachableTrack);
      } else {
        video.onloadeddata = async () => {
          // @ts-ignore
          video.onloadeddata = noop;
          if (this._videosByParticipantId.has(participantId)) {
            console.error(
              "Conference - Race condition with remote video",
              track
            );
          } else {
            console.log("Conference - Remote video loaded");
            this._videosByParticipantId.set(participantId, attachableTrack);
            await this._notifyRemoteJoined(participantId);
          }
        };
      }
      await attachableTrack.attach();
    }
  }

  private async _onParticipantJoined(participantId: any, participant: any) {
    this._JitsiStatusLogger('Someon joined the confrence !')

    await this._onParticipantDisplayNameChanged(
      participantId,
      participant.getDisplayName()
    );
  }

  private async _onParticipantDisplayNameChanged(
    participantId: any,
    displayName: any
  ) {
    
    if (!displayName) {
      this._JitsiStatusLogger('One Remote joined - NO display name :|' )
      console.log("Conference - No remote display name yet");
      return;
    }
    if (this._membersByParticipantId.has(participantId)) {
      console.warn("Conference - Remote display name already set");
      return;
    }
    this._JitsiStatusLogger('One Remote joined - display name :' , displayName)

    console.log("Conference - Setting remote display name");
    const member = displayName;
    this._membersByParticipantId.set(participantId, member);
    if (this._audiosByParticipantId.has(participantId)) {
      // @ts-ignore
      this._audiosByParticipantId
        .get(participantId)
        .element.setAttribute("dashboardMenuUtils-member-uuid", member.uuid);
    }
    if (this._videosByParticipantId.has(participantId)) {
      // @ts-ignore
      this._videosByParticipantId
        .get(participantId)
        .element.setAttribute("dashboardMenuUtils-member-uuid", member.uuid);
    }
    await this._notifyRemoteJoined(participantId);
  }

  private async _notifyRemoteJoined(participantId: string) {
    this._JitsiStatusLogger('One Remote joined the confrence !')

    const shouldNotify =
      this._audiosByParticipantId.has(participantId) &&
      this._videosByParticipantId.has(participantId) &&
      this._membersByParticipantId.has(participantId);
    if (shouldNotify) {
      console.log("Conference - Remote ready");
      const audio = this._audiosByParticipantId.get(participantId);
      const video = this._videosByParticipantId.get(participantId);
      const member = this._membersByParticipantId.get(participantId);
      console.warn("memberX", member);
      // @ts-ignore
      await this._onRemoteJoined(audio.element, video.element, member);
    }
  }

  onTrackAudioLevelChanged(
    onTrackAudioLevelChanged: (participantId: string, audioLevel: number) => any
  ) {
    this._onTrackAudioLevelChanged = onTrackAudioLevelChanged;
    return this;
  }

  onTrackMuteChanged(onTrackMuteChanged: (track: any) => any) {
    this._onTrackMuteChanged = onTrackMuteChanged;
    return this;
  }

  private async _onParticipantLeft(participantId: any) {
    const promises = [];

    this._JitsiStatusLogger('this._membersByParticipantId',this._membersByParticipantId )

    // console.log(this._videosByParticipantId)
    if (this._videosByParticipantId.has(participantId)) {
      const track: any = this._videosByParticipantId.get(participantId);
      this._videosByParticipantId.delete(participantId);
      promises.push(track.dispose());
    }
    if (this._audiosByParticipantId.has(participantId)) {
      const track: any = this._audiosByParticipantId.get(participantId);
      this._audiosByParticipantId.delete(participantId);
      promises.push(track.dispose());
    }
    if (this._membersByParticipantId.has(participantId)) {
      const member: any = this._membersByParticipantId.get(participantId);
      this._membersByParticipantId.delete(participantId);
      if (promises.length === 2) {
        promises.push(this._onRemoteLeft(member, participantId));
      }
    }
    if (promises.length === 3) {
      console.log("Conference - Remote left");
    } else {
      console.warn("Conference - Remote left before being ready");
    }
    return await Promise.all(promises);
  }

  private async _onConnectionFailed(...args: any) {
    console.error("Conference - Connection failed", args);
    await this.quit("connection_failed");
  }

  private async _onConferenceFailed(...args: any) {
    this._JitsiStatusLogger('Jitsi initializes failed -> quit')

    console.error("Conference - Conference failed", args);
    await this.quit("conference_failed");
  }

  get member() {
    return this._member;
  }

  private _JitsiStatusLogger(...logs:any[]){
    console.warn( '👉 Jitsi Module Status Report :' ,...logs)
  }

}
