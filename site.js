// Shared by every page: the header's "my star" link remembers who you are (set by "This is me" on a profile,
// or by opening the decoration workbench as yourself).
(function () {
  let me = ''; try { me = localStorage.getItem('cosmic.me') || ''; } catch (e) {}
  const a = document.getElementById('nav-me'); if (!a) return;
  if (me) { a.href = 'profile.html?u=' + encodeURIComponent(me); a.querySelector('span').textContent = me; a.title = 'Your star'; a.classList.add('known'); }
  else a.href = 'index.html#find';
})();
