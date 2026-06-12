// The landing intro — a single 1.0s wordmark reveal (playbook Phase 6).
// CONVIQT fades in while its letter-spacing tightens into place, then the
// overlay lifts and the hero is already there. Pure CSS animation (no WebGL,
// no JS after first paint); styles live in app.css under "Landing intro".
//
// Once per session: the inline script below runs synchronously before paint,
// so a repeat visitor (sessionStorage key set) never sees a flash — the
// overlay is display:none'd before the browser renders it. It re-executes on
// client-side navigations back to "/" too (React re-inserts the script node).
//
// prefers-reduced-motion is respected twice: the script skips the intro, and
// a CSS media query disables it even when JS never runs.

const INTRO_SCRIPT = `(function(){try{var d=document.getElementById("cvq-intro");if(!d)return;var m=window.matchMedia("(prefers-reduced-motion: reduce)").matches;if(m||sessionStorage.getItem("cvq-intro-seen")){d.style.display="none";}else{sessionStorage.setItem("cvq-intro-seen","1");}}catch(e){}})();`;

export function WordmarkIntro() {
  return (
    <>
      <div id="cvq-intro" className="cvq-intro" aria-hidden="true">
        <span className="cvq-intro-word" data-no-translate>
          CONVI<span className="cvq-intro-q">Q</span>T
        </span>
      </div>
      <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
    </>
  );
}
