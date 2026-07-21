export type VirtualHumanConfig =
  | {
      enabled: false;
      provider: 'three-fallback';
      reason: string;
    }
  | {
      enabled: true;
      provider: 'xfyun-vms';
      serviceId: string;
      sdkScriptUrl: string;
      startConfig: {
        appId: string;
        apiKey: string;
        apiSecret: string;
        avatarId: string;
        width: 720;
        height: 1280;
        isSsl: boolean;
        transparent: boolean;
        moveH: number;
        moveV: number;
        scale: number;
      };
      tts: {
        vcn: string;
        speed: number;
        pitch: number;
        volume: number;
        rhy: number;
      };
    };

export type SpeechDriver = 'browser' | 'xfyun';
