/* PLAY NIGHT — kalıcı durum (profil, arkadaşlar, ayarlar, istatistik) */
(function (w) {
  'use strict';

  const bridge = w.pn && w.pn.store ? w.pn.store : null;

  /* Electron dışında (tarayıcı testinde) localStorage'a düş */
  const fallback = {
    get: async () => { try { return JSON.parse(localStorage.getItem('playnight') || 'null') || defaults(); } catch { return defaults(); } },
    set: async (d) => { localStorage.setItem('playnight', JSON.stringify(d)); return true; },
    path: async () => 'localStorage',
  };
  const io = bridge || fallback;

  function defaults() {
    return {
      profile: null,
      friends: [],
      requests: [],
      settings: { sound: true, music: true, volume: 0.6, animations: 'full', skipIntro: false, turnSeconds: 30, iceServers: null },
      stats: { okey101: { played: 0, won: 0, bestScore: null } },
    };
  }

  let data = defaults();
  const listeners = new Set();

  async function load() {
    const d = await io.get();
    data = Object.assign(defaults(), d || {});
    data.settings = Object.assign(defaults().settings, data.settings || {});
    data.stats = Object.assign(defaults().stats, data.stats || {});
    data.friends = Array.isArray(data.friends) ? data.friends : [];
    data.requests = Array.isArray(data.requests) ? data.requests : [];

    if (!data.profile || !data.profile.id) {
      data.profile = {
        id: w.U.makeCode(6),
        name: 'Oyuncu' + Math.floor(100 + Math.random() * 900),
        color: Math.floor(Math.random() * w.U.AVATAR_COLORS.length),
        createdAt: Date.now(),
      };
      await save();
    }
    if (typeof data.profile.color !== 'number') data.profile.color = 0;
    return data;
  }

  let saveTimer = null;
  function save() {
    return new Promise((res) => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => { await io.set(data); res(true); }, 60);
    });
  }

  function emit() { for (const fn of listeners) { try { fn(data); } catch (e) { console.error(e); } } }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  const get = () => data;
  const profile = () => data.profile;
  const settings = () => data.settings;

  async function update(mutator) {
    mutator(data);
    await save();
    emit();
    return data;
  }

  /* ------------------------------------------------------ arkadaşlar --- */
  const findFriend = (id) => data.friends.find((f) => f.id === id);

  async function addFriend(f) {
    if (!f || !f.id || f.id === data.profile.id) return false;
    if (findFriend(f.id)) {
      return update((d) => {
        const ex = d.friends.find((x) => x.id === f.id);
        if (f.name) ex.name = f.name;
        if (typeof f.color === 'number') ex.color = f.color;
      }).then(() => 'updated');
    }
    await update((d) => {
      d.friends.push({ id: f.id, name: f.name || f.id, color: f.color || 0, addedAt: Date.now() });
      d.requests = d.requests.filter((r) => r.id !== f.id);
    });
    return 'added';
  }

  const removeFriend = (id) => update((d) => { d.friends = d.friends.filter((f) => f.id !== id); });

  const addRequest = (r) => update((d) => {
    if (d.friends.some((f) => f.id === r.id) || d.requests.some((x) => x.id === r.id)) return;
    d.requests.push({ id: r.id, name: r.name || r.id, color: r.color || 0, at: Date.now() });
  });

  const removeRequest = (id) => update((d) => { d.requests = d.requests.filter((r) => r.id !== id); });

  /* --------------------------------------------------------- ayarlar --- */
  const setSetting = (k, v) => update((d) => { d.settings[k] = v; });

  const bumpStat = (game, field, by) => update((d) => {
    if (!d.stats[game]) d.stats[game] = {};
    d.stats[game][field] = (d.stats[game][field] || 0) + (by === undefined ? 1 : by);
  });

  const storePath = () => io.path();

  w.Store = { load, save, get, profile, settings, update, subscribe,
              addFriend, removeFriend, findFriend, addRequest, removeRequest,
              setSetting, bumpStat, storePath };
})(window);
