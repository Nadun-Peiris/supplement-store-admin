declare module "@lottiefiles/react-lottie-player" {
  import * as React from "react";

  interface PlayerProps {
    autoplay?: boolean;
    loop?: boolean;
    src: string;
    className?: string;
    style?: React.CSSProperties;
  }

  export const Player: React.FC<PlayerProps>;
}

declare module "nodemailer" {
  interface TransportOptions {
    service?: string;
    auth?: {
      user?: string;
      pass?: string;
    };
  }

  interface MailOptions {
    from?: string;
    to?: string;
    subject?: string;
    html?: string;
  }

  interface Transporter {
    sendMail(options: MailOptions): Promise<unknown>;
  }

  interface NodemailerModule {
    createTransport(options: TransportOptions): Transporter;
  }

  const nodemailer: NodemailerModule;
  export default nodemailer;
}
