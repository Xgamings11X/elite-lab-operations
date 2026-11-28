import {cookies} from 'next/headers';
import {login} from '../frontend/src/views.js';
import Portal from './portal';

export default async function Page(){
  const hasSession=Boolean((await cookies()).get('elite_session')?.value);
  return <><a className="skip" href="#main">Lewati ke konten</a>
    {hasSession
      ? <div id="app"><header className="restore-header"><img src="/elite-logo.png" width="110" alt="ELITE"/></header><main id="main" tabIndex={-1} aria-busy="true"/></div>
      : <div id="app" dangerouslySetInnerHTML={{__html:login(false)}}/>}
    <div id="toast" role="status" aria-live="polite"/><dialog id="dialog"/><Portal/></>;
}
