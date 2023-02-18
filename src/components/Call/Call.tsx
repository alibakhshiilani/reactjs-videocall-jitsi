import { useContext, useEffect, useRef, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import {
  localTracksInterface,
  remoteTracksInterface,
  TrackersTypeEnum,
} from "./call.type";
import { Conference } from "./../../modules/Conference/Conference";
import { removeTrackFromDOM } from "./call.utils";

import {
  CallUrlParamInterface,
  JitsiInterface,
} from "../../../../components/chat/chat.type";
import {
  getJitsiService,
  getJPNormalService,
  getSessionService,
} from "../../chat.service";
import { toast } from "../../../../components/toast";
import { errorMessageHandler } from "../../../../app/utils";
import "./call.style.scss";
import CustomSpin from "../../../../components/customSpin/CustomSpin";

import avatat from "../../../../assets/images/avatar.png";
import Timer from "../../../../components/chat/timer/Timer";
import { ContextTypes, SessionState } from "../../chat.context";

let conference: Conference | null = null;

const Call = (props: any) => {
  const { sessionId, chatType } = useContext(SessionState) as ContextTypes;
  const { type = CallTypesEnum.VIDEO, id } = useParams<CallUrlParamInterface>();
  const [jitsi, setJitsi] = useState<JitsiInterface>();
  // const onlyAudioCall = props.callType && props.callType === "audio";
  // const onlyAudioCall = false;
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [muteAudio, setMuteAudio] = useState(false);
  const [muteVideo, setMuteVideo] = useState(false);
  const [participantsAudioLevels, setParticipantsAudioLevels] = useState({});
  const localTracksRef = useRef<HTMLDivElement>(null);
  const remoteTracksRef = useRef<HTMLDivElement>(null);
  // const smallLocalTracksRef = useRef<HTMLDivElement>(null);
  // const smallRemoteTracksRef = useRef<HTMLDivElement>(null);
  const [localTracks, setLocalTracks] = useState<localTracksInterface>({
    audio: undefined,
    video: undefined,
    member: undefined,
  });
  const [remoteTracks, setRemoteTracks] = useState<remoteTracksInterface>({});
  const [usersInfo, setUsersInfo] = useState<{
    lawyerAvatar: string;
    clientAvatar: string;
  }>({
    lawyerAvatar: avatat,
    clientAvatar: avatat,
  });
  const [tracker, setTracker] = useState<
    TrackersTypeEnum[keyof TrackersTypeEnum]
  >(TrackersTypeEnum.REMOTE);

  const [remoteTrackerId, setRemoteTrackerId] = useState<string>();
  const [remoteTrackerMuted, setRemoteTrackerMuted] = useState(false);


  useEffect(() => {
    const type =
      chatType.get.toUpperCase() === ChatTypesEnum.ONLINE ||
      chatType.get.toUpperCase() === ChatTypesEnum.URGENT
        ? "SESSION"
        : "JPAPER";

    // getJitsiService({ sessionId: sess })
    getJitsiService({ sessionId: sessionId?.get, type })
      .then((response) => {
        setLoading(false);

        if (response?.data?.username) {
          setJitsi({ ...response.data });
        }
      })
      .catch((error) => {
        console.error(error);
        setLoading(false);
        console.log("err in chat context - jp", error);

        toast({
          type: "error",
          content: errorMessageHandler(error),
        });
      });
  }, []);

  useEffect(() => {
    if (localTracksRef && localTracksRef.current && localTracks) {
      console.log("----- we have local track ", localTracks);
      if (localTracks.video && !muteVideo) {
        console.log("append - local - video");
        localTracksRef.current.appendChild(localTracks.video);
      }

      if (localTracks.audio) {
        console.log("append - local - audio");
        localTracksRef.current.appendChild(localTracks.audio);
      }
    } else {
      console.log("-----no local track ");
    }
    // eslint-disable-next-line
  }, [localTracks, localTracksRef]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const voiceOnly = params.get("voice-only");
    if (voiceOnly === "true") {
      console.log("voiceOnly true ");
      setMuteVideo(true);
    } else {
      console.log("voiceOnly false ");
      setMuteVideo(false);
    }
  }, []);

  useEffect(() => {
    if (remoteTracksRef && remoteTracksRef.current) {
      if (remoteTracks) {
        // @ts-ignore
        Object.entries(remoteTracks).forEach(([key, track]) => {
          console.warn("track", track);
          // @ts-ignore
          if (remoteTracksRef.current) {
            if (track.video && !muteVideo) {
              console.log("append - remote - video");

              // @ts-ignore
              remoteTracksRef.current.appendChild(track.video);
            }
            // @ts-ignore
            if (track.audio) {
              console.log("append - remote - audio");
              remoteTracksRef.current.appendChild(track.audio);
            }
          }
        });
      }
    }

    // eslint-disable-next-line
  }, [remoteTracks, jitsi]);

  useEffect(() => {
    if (jitsi) {
      conference = new Conference()
        .onLocalJoined((audio, video, member) => {
          console.log("onLocalJoined", {
            audio,
            video,
            member,
          });
          setLocalTracks({
            audio,
            video,
            member,
          });
          setLoading(false);
          conference && muteVideo && conference.muteVideoTrack(true);
          console.warn("onLocalJoined", audio, video, member);
        })
        .onRemoteJoined((audio, video, member) => {
          console.warn("onRemoteJoined", audio, video, member);
          console.log("setRemoteTrackerMuted change 1 ( onRemoteJoined )");
          if (video) {
            setRemoteTrackerMuted(false);
          } else {
            setRemoteTrackerMuted(false);
          }
          console.log("member", member);
          const remoteTrackerId = Math.random();
          setRemoteTrackerId(remoteTrackerId.toString());
          setRemoteTracks({
            ...remoteTracks,
            ...{
              [`${remoteTrackerId}`]: {
                audio,
                video,
                member,
              },
            },
          });

          // message.success(`${member} Joined`);
        })
        .onRemoteLeft((member, participantId) => {
          console.warn("onRemoteLeft", member, participantId);
          // @ts-ignore
          if (participantId && participantsAudioLevels[participantId]) {
            // @ts-ignore
            delete participantsAudioLevels[participantId];
          }
          removeTrackFromDOM(remoteTracksRef, participantId);

          remoteTrackerId && delete remoteTracks[remoteTrackerId];
        })
        .onTrackAudioLevelChanged((participantId, audioLevel) => {
          // console.warn("onTrackAudioLevelChanged participantId", participantId);
          // console.warn("onTrackAudioLevelChanged audioLevel", audioLevel);
          setParticipantsAudioLevels({
            ...participantsAudioLevels,
            ...{
              [participantId]: audioLevel,
            },
          });
        })
        .onError((error) => {
          console.warn("onError", error);
          setLoading(false);
        })
        .join(jitsi.roomId, jitsi.username, jitsi.username, jitsi.key)
        .onTrackMuteChanged((track: any) => {
          console.log("call : onRemoteTrackMuteChanged", track);
          if (track.isLocal()) {
            console.log(
              "setRemoteTrackerMuted change 2 ( onTrackMuteChanged ) - Local",
              track
            );

            if ("stream" in track && track.stream !== null) {
              console.log(
                "setRemoteTrackerMuted change 2 ( onTrackMuteChanged ) - Local",
                "local stream is not null ",
                track
              );
            }
          } else {
            // eslint-disable-next-line no-lonely-if
            if (
              !("stream" in track) ||
              track.stream === null ||
              ("muted" in track.stream && track.stream.muted)
            ) {
              if (
                "track" in track &&
                "kind" in track.track &&
                track.track.kind === "video"
              ) {
                console.log(
                  "setRemoteTrackerMuted change 2 ( onTrackMuteChanged ) - true"
                );
                setRemoteTrackerMuted(true);
              }
            } else {
              console.log(
                "setRemoteTrackerMuted change 2 ( onTrackMuteChanged ) - false ",
                track
              );
              setRemoteTrackerMuted(false);
            }
          }
        });
    }
    console.warn("conference", conference);

    return function cleanup() {
      conference && conference.quit();
    };
    // eslint-disable-next-line
  }, [jitsi]);

  useEffect(() => {
    console.log("remoteTrackerMuted", remoteTrackerMuted);
  }, [remoteTrackerMuted]);

  useEffect(() => {
    conference && conference.muteAudioTrack(muteAudio);
    // eslint-disable-next-line
  }, [muteAudio]);

  useEffect(() => {
    if (conference && jitsi) {
      conference.muteVideoTrack(muteVideo);
      console.log("conference -> muteVideoTrack", muteVideo);
    }
    // eslint-disable-next-line
  }, [muteVideo]);

  // const changeVideoClassBasedOnHigherVoice = (participantId: string) => {
  //   console.log("participantID", participantId);
  //   const videoTag =
  //     remoteTracksRef.current &&
  //     remoteTracksRef.current.querySelector(
  //       `video[data-participant-id='${participantId}']`
  //     );
  //
  //   if (videoTag) {
  //     videoTag.classList.add("active-video");
  //   }
  // };

  // const getHighestNumber = (obj: any) => {
  //   console.log("obj", obj);
  //   return Object.keys(obj).reduce((a, b) => (obj[a] > obj[b] ? a : b));
  // };
  //
  // useEffect(() => {
  //   if (
  //     participantsAudioLevels &&
  //     Object.keys(participantsAudioLevels).length > 0
  //   ) {
  //     changeVideoClassBasedOnHigherVoice(
  //       getHighestNumber(participantsAudioLevels)
  //     );
  //   }
  // }, [participantsAudioLevels]);

  const toggleTracker = (tracker: TrackersTypeEnum[keyof TrackersTypeEnum]) => {
    setTracker(tracker);
    console.log("toggling");
  };

  return (
    <>
      <CustomSpin show={loading} />
      <div className="call">
        <div className="content">
          {/**/}
          <div
            className={[
              tracker === TrackersTypeEnum.REMOTE ? "tracker" : "small-tracker",
            ].join(" ")}
            ref={remoteTracksRef}
            onClick={toggleTracker.bind(null, TrackersTypeEnum.REMOTE)}
          />
          <div
            className={[
              tracker === TrackersTypeEnum.LOCAl ? "tracker" : "small-tracker",
            ].join(" ")}
            ref={localTracksRef}
            onClick={toggleTracker.bind(null, TrackersTypeEnum.LOCAl)}
          />
          {/**/}

          {muteVideo && tracker === TrackersTypeEnum.LOCAl ? (
            <>
              <div className="no-video">
                <div
                  className="personal-photo"
                  style={{
                    backgroundImage: `url(${usersInfo.clientAvatar})`,
                  }}
                />
              </div>
            </>
          ) : null}

          {muteVideo && tracker === TrackersTypeEnum.REMOTE ? (
            <>
              <div
                className="new-small-tracker"
                onClick={toggleTracker.bind(null, TrackersTypeEnum.LOCAl)}
                style={{
                  backgroundImage: `url(${usersInfo.clientAvatar})`,
                }}
              />
            </>
          ) : null}

          {remoteTrackerMuted && tracker === TrackersTypeEnum.REMOTE ? (
            <>
              <div className="no-video">
                <div
                  className="personal-photo"
                  style={{
                    backgroundImage: `url(${usersInfo.lawyerAvatar})`,
                  }}
                />
              </div>
            </>
          ) : null}

          {remoteTrackerMuted && tracker === TrackersTypeEnum.LOCAl ? (
            <>
              <div
                className="new-small-tracker"
                onClick={toggleTracker.bind(null, TrackersTypeEnum.REMOTE)}
                style={{
                  backgroundImage: `url(${usersInfo.lawyerAvatar})`,
                }}
              />
            </>
          ) : null}

          {/**/}
        </div>
        <div className="video-controls">
          <div className="controls">
            <div
              className={muteAudio ? "active" : ""}
              onClick={() => {
                setMuteAudio(!muteAudio);
              }}
            >
              {!muteAudio ? <span>AUDIO ACTIVE ICON</span> : <span>AUDIO DEACTIVE ICON</span> }
            </div>

            <div
              className={muteVideo ? "active" : ""}
              onClick={() => {
                setMuteVideo((prev) => !prev);
              }}
            >
              {muteVideo ? <span>CAMERADEACTIVE ICON</span> : <span>CAMERAACTIVE ICON</span>}
            </div>

            <div
              className="end-call"
              onClick={async () => {
                conference && (await conference.quit());
                // history.goBack();
                history.push(`/chat/${chatType.get}/${sessionId.get}`);
              }}
            >
              <span>PHONE ICON</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Call;
