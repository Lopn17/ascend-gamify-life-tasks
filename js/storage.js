(function(root) {
  'use strict';
  const KEY='ascend-v1';
  function read() {
    try {
      const raw=localStorage.getItem(KEY);
      return {state:raw?AscendCore.validate(JSON.parse(raw),CATEGORIES,ACHIEVEMENTS,CATEGORY_ICONS):AscendCore.fresh(),raw,error:null};
    } catch(error) { return {state:AscendCore.fresh(),error:'Your saved data could not be read. It has not been overwritten. Export a recovery copy in Settings, or restore a valid backup.'}; }
  }
  function write(state) {
    try { localStorage.setItem(KEY,JSON.stringify(state)); }
    catch { throw new Error('Your browser could not save this change. Free some storage or allow site storage, then try again.'); }
  }
  root.AscendStorage = {KEY,read,write};
})(globalThis);
