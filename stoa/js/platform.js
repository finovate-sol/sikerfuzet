// Platform-réteg: minden, ami natív appban (Capacitor) másképp megy, ide kerül,
// hogy a becsomagoláskor csak ezt a fájlt kelljen kicserélni.

// rövid rezgés (Androidon a böngészőben is; natívban Haptics pluginra cserélhető)
export function rezeg(minta = 10){ try { navigator.vibrate && navigator.vibrate(minta); } catch(_) {} }

// helyi tárolás (natívban Preferences pluginra cserélhető)
export const tar = {
    get(k, alap){ try { const v = localStorage.getItem('stoa_' + k); return v == null ? alap : JSON.parse(v); } catch(_) { return alap; } },
    set(k, v){ try { localStorage.setItem('stoa_' + k, JSON.stringify(v)); } catch(_) {} },
    del(k){ try { localStorage.removeItem('stoa_' + k); } catch(_) {} },
};

// van-e hálózat
export const online = () => navigator.onLine !== false;

// külső link megnyitása (natívban Browser plugin)
export function nyit(url, ujLap = false){ if(ujLap) window.open(url, '_blank', 'noopener'); else location.href = url; }

// telepített (kezdőképernyős) módban fut-e
export const telepitett = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch(_) { return false; } };
