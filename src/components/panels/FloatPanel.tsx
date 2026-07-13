import { memo, useState } from 'react';
import { FloatArithmeticPanel } from './FloatArithmeticPanel';
import { FloatRepresentationPanel } from './FloatRepresentationPanel';

type FloatTab = 'arithmetic' | 'representation';

export const FloatPanel = memo(function FloatPanel() {
  const [tab, setTab] = useState<FloatTab>('arithmetic');
  return (
    <div className='float-tabs'>
      <div className='segmented-control float-tabs__bar' role='tablist' aria-label='浮点功能'>
        <button type='button' role='tab' aria-selected={tab === 'arithmetic'}
          className={tab === 'arithmetic' ? 'segment-button segment-button--active' : 'segment-button'}
          onClick={() => setTab('arithmetic')}>浮点数运算</button>
        <button type='button' role='tab' aria-selected={tab === 'representation'}
          className={tab === 'representation' ? 'segment-button segment-button--active' : 'segment-button'}
          onClick={() => setTab('representation')}>浮点数表示</button>
      </div>
      <div className='float-tabs__body'>
        {tab === 'arithmetic' ? <FloatArithmeticPanel /> : <FloatRepresentationPanel />}
      </div>
    </div>
  );
});
