(() => {
  if (location.protocol === 'file:') document.getElementById('fileNotice').hidden = false;
  const image = document.getElementById('referenceImage');
  const zoom = document.getElementById('zoom');
  const zoomValue = document.getElementById('zoomValue');
  function setZoom() { image.style.width = `${zoom.value}%`; zoomValue.textContent = `${zoom.value}%`; }
  zoom.addEventListener('input', setZoom);
  document.getElementById('resetZoom').addEventListener('click', () => { zoom.value = 100; setZoom(); document.getElementById('referenceFrame').scrollTo(0, 0); });
  let character = 'human_boy_v1', view = 'front';
  function updatePreview() {
    const params = new URLSearchParams({review:'1', character, view, wireframe:document.getElementById('wireframe').checked ? '1' : '0'});
    document.getElementById('prototype').src = `character-lab.html?${params}`;
  }
  for (const button of document.querySelectorAll('[data-character]')) button.addEventListener('click', () => {
    character = button.dataset.character;
    document.querySelectorAll('[data-character]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    updatePreview();
  });
  for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => {
    view = button.dataset.view;
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    updatePreview();
  });
  document.getElementById('wireframe').addEventListener('change', updatePreview);
  fetch('assets/reference/development.json').then(r => { if (!r.ok) throw Error('Roadmap unavailable'); return r.json(); }).then(data => {
    const host = document.getElementById('milestones'); host.replaceChildren();
    for (const milestone of data.milestones) {
      const row = document.createElement('article'); row.className = 'milestone';
      const id = document.createElement('span'); id.className = 'milestone-id'; id.textContent = milestone.id;
      const text = document.createElement('div'); const title = document.createElement('h3'); title.textContent = milestone.title;
      const description = document.createElement('p'); description.textContent = milestone.description; text.append(title, description);
      const status = document.createElement('span'); status.className = `milestone-status ${milestone.status}`; status.textContent = milestone.status === 'complete' ? 'COMPLETE' : milestone.status === 'in_progress' ? 'IN PROGRESS' : milestone.status === 'next' ? 'NEXT' : 'PENDING';
      row.append(id, text, status); host.append(row);
    }
  }).catch(() => { document.getElementById('milestones').textContent = 'Roadmap could not load. Use the full roadmap download above.'; });
})();
