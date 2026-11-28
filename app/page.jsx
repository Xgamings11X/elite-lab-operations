import {login} from '../frontend/src/views.js';
import Portal from './portal';

function LoadingGrid(){
  return <div id="transition" className="boot-grid" aria-hidden="true">
    <svg className="screen-grid" viewBox="0 0 12 12" preserveAspectRatio="xMidYMid slice" focusable="false">
      {Array.from({length:12},(_,phase)=><g key={phase} style={{animationDelay:(phase-12)*90+'ms'}}>
        {Array.from({length:12},(_,y)=><rect key={y} x={(phase-y+12)%12} y={y} width=".995" height=".995"/>)}
      </g>)}
    </svg>
    <div className="loading-plaque"><strong>LOADING</strong><small className="route-label">Membuka ELITE</small></div>
  </div>;
}
export default function Page(){
  return <><a className="skip" href="#main">Lewati ke konten</a>
    <div id="app" dangerouslySetInnerHTML={{__html:login(false)}}/><LoadingGrid/>
    <div id="toast" role="status" aria-live="polite"/><dialog id="dialog"/><Portal/></>;
}
