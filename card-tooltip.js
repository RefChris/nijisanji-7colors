(() => {
  const colors = {
    R: ['빨강', '#e44872'], O: ['주황', '#ef9252'], Y: ['노랑', '#e8ce52'],
    G: ['초록', '#5fc594'], B: ['파랑', '#58bfdc'], I: ['남색', '#8799ec'], V: ['보라', '#c28adf']
  };
  const inspector = document.querySelector?.('#card-inspector-content');
  const tooltip = inspector || document.createElement('aside');
  if (!inspector) {
    tooltip.id = 'card-tooltip';
    tooltip.className = 'card-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('popover', 'manual');
    tooltip.hidden = true;
    document.body.append(tooltip);
  }
  let active = null;
  let dragging = false;

  function cardAt(target) {
    const img = target.closest?.('img');
    if (!img || (inspector && img.closest('#card-inspector')) || img.closest('.concealed') || img.closest('.set-hidden')&&img.dataset?.owner!=='player') return null;
    const match = (img.getAttribute('src') || '').match(/NJ-SD(01|02|03|04)-(\d{3})\.png(?:\?.*)?$/);
    const id=match?(match[1]==='04'?300:match[1]==='03'?200:match[1]==='01'?100:0)+Number(match[2]):null;return id&&CardInfo[id]?{img,id}:null;
  }

  function hide() {
    if (active) active.removeAttribute('aria-describedby');
    if (!inspector) {
      if (tooltip.matches(':popover-open')) tooltip.hidePopover();
      tooltip.hidden = true;
    }
    active = null;
  }

  function row(label, value) {
    const group = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    group.append(term, description);
    return group;
  }

  function render(card) {
    hide();
    const info = CardInfo[card.id];
    const heading = document.createElement('h2');
    heading.textContent = info.name;
    const type = document.createElement('small');
    type.textContent = `${info.type} · NJ-SD${card.id>=300?'04':card.id>=200?'03':card.id>=100?'01':'02'}-${String(card.id>=300?card.id-300:card.id>=200?card.id-200:card.id>=100?card.id-100:card.id).padStart(3,'0')}`;
    const stats = document.createElement('dl');
    stats.className = 'tooltip-stats';
    stats.append(row('레벨', info.level === null ? '—' : String(info.level)),
      row('파워', info.power === null ? '—' : Number(card.img.dataset?.effectivePower??info.power).toLocaleString('ko-KR')));
    const colorRow = row('컬러', info.colors.length ? '' : '없음');
    for (const code of info.colors) {
      const chip = document.createElement('span');
      chip.className = 'tooltip-color';
      chip.style.setProperty('--chip-color', colors[code][1]);
      chip.textContent = `${code} ${colors[code][0]}`;
      colorRow.lastElementChild.append(chip);
    }
    const effect = row('효과', info.effect);
    const details = document.createElement('dl');
    details.className = 'tooltip-details';
    details.append(colorRow, effect);
    if (inspector) {
      const preview = document.createElement('img');
      preview.className = 'inspector-card-image';
      preview.src = card.img.getAttribute('src');
      preview.alt = `${info.name} 카드 확대`;
      preview.draggable = false;
      tooltip.replaceChildren(preview, heading, type, stats, details);
    } else tooltip.replaceChildren(heading, type, stats, details);
    active = card.img;
    active.setAttribute('aria-describedby', tooltip.id);
    tooltip.hidden = false;
    if (!inspector) tooltip.showPopover?.();
  }

  function position(x, y) {
    if (inspector) return;
    const gap = 16, edge = 10;
    const {width, height} = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(edge, Math.min(x - width / 2, innerWidth - width - edge))}px`;
    // Prefer above the pointer; flip below when close to the top edge.
    const top = y - height - gap >= edge ? y - height - gap : y + gap;
    tooltip.style.top = `${Math.max(edge, Math.min(top, innerHeight - height - edge))}px`;
  }

  document.addEventListener('pointermove', event => {
    if (dragging || event.pointerType === 'touch') return;
    const card = cardAt(event.target);
    if (!card) { hide(); return; }
    if (active !== card.img) render(card);
    position(event.clientX, event.clientY);
  });
  document.addEventListener('pointerout', event => {
    if (active === event.target && !active.contains(event.relatedTarget)) hide();
  });
  document.addEventListener('dragstart', () => { dragging = true; hide(); });
  document.addEventListener('dragend', () => { dragging = false; hide(); });
  document.addEventListener('drop', () => { dragging = false; hide(); });
  document.addEventListener('pointerdown', hide);
  document.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  window.addEventListener('blur', hide);
  window.addEventListener('resize', hide);
  document.addEventListener('focusin', event => {
    const card = cardAt(event.target);
    if (!card) return;
    render(card);
    const bounds = card.img.getBoundingClientRect();
    position(bounds.x + bounds.width / 2, bounds.y);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('card-power-change',()=>{if(active){const card=cardAt(active);if(card)render(card)}});
})();
