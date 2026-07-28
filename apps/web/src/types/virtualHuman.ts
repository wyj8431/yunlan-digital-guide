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
      signedUrl: string;
      actions: Array<{
        id: string;
        label: string;
      }>;
      startConfig: {
        appId: string;
        apiKey?: string;
        apiSecret?: string;
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
    }
  | {
      enabled: true;
      provider: 'mofa-xingyun';
      serviceId: string;
      sdkScriptUrl: string;
      appId: string;
      appSecret: string;
      gatewayServer: string;
      actions: Array<{
        id: string;
        label: string;
      }>;
      startConfig: {
        hardwareAcceleration: 'prefer-hardware';
        enableLogger: boolean;
      };
    };

export type SpeechDriver = 'browser' | 'xfyun' | 'mofa';
