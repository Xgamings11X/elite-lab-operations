import {login} from '../frontend/src/views.js';
import Portal from './portal';

export default function Page(){
  return <><a className="skip" href="#main">Lewati ke konten</a>
    <div id="app" dangerouslySetInnerHTML={{__html:login(false)}}/>
    <div id="toast" role="status" aria-live="polite"/><dialog id="dialog"/><Portal/></>;
}
