/// <reference types="vite/client" />

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module 'csstype' {
  interface Properties {
    WebkitAppRegion?: 'drag' | 'no-drag' | string;
  }
}
