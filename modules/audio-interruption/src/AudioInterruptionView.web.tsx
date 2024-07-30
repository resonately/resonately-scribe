import * as React from 'react';

import { AudioInterruptionViewProps } from './AudioInterruption.types';

export default function AudioInterruptionView(props: AudioInterruptionViewProps) {
  return (
    <div>
      <span>{props.name}</span>
    </div>
  );
}
