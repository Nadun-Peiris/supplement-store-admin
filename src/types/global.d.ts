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
