export const serviceUrl = process.env.REACT_APP_JITSI;

export const jitsiOptions = {
  serviceUrl: `wss://${serviceUrl}/xmpp-websocket`,
  hosts: {
    domain: serviceUrl,
    muc: `conference.${serviceUrl}`, // FIXME: use XEP-0030
    bridge: `jitsi-videobridge.${serviceUrl}`,
  },
  // bosh: "https://jitsi.tarhvareh.com/http-bind", // FIXME: use xep-0156 for that

  // The name of client node advertised in XEP-0115 'c' stanza
  clientNode: `https://${serviceUrl}`,
};

export const confOptions = {
  openBridgeChannel: true,
  p2p: {
    enabled: false,
  },
};

export {};
