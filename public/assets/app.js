(() => {
  const $ = (selector) => document.querySelector(selector);

  const el = {
    grid: $('#grid'),
    empty: $('#empty'),
    emptyTitle: $('#emptyTitle'),
    emptyText: $('#emptyText'),
    count: $('#count'),
    viewTitle: $('#viewTitle'),
    search: $('#search'),
    searchWrap: $('#searchWrap'),
    dropzone: $('#dropzone'),
    dzHint: $('#dzHint'),
    fileInput: $('#fileInput'),
    uploadTrigger: $('#uploadTrigger'),
    uploadStatus: $('#uploadStatus'),
    uploadFill: $('#uploadFill'),
    uploadText: $('#uploadText'),
    galleryView: $('#galleryView'),
    groupTools: $('#groupTools'),
    viewList: $('#viewList'),
    groupList: $('#groupList'),
    groupEmpty: $('#groupEmpty'),
    countAll: $('#countAll'),
    countUngrouped: $('#countUngrouped'),
    countShared: $('#countShared'),
    newGroup: $('#newGroup'),
    renameGroup: $('#renameGroup'),
    deleteGroup: $('#deleteGroup'),
    sharedView: $('#sharedView'),
    shareList: $('#shareList'),
    sharedEmpty: $('#sharedEmpty'),
    lightbox: $('#lightbox'),
    lightboxImage: $('#lightboxImage'),
    lightboxName: $('#lightboxName'),
    lightboxMeta: $('#lightboxMeta'),
    lightboxGroup: $('#lightboxGroup'),
    lightboxDelete: $('#lightboxDelete'),
    lightboxShare: $('#lightboxShare'),
    shareModal: $('#shareModal'),
    shareUrl: $('#shareUrl'),
    shareCopy: $('#shareCopy'),
    shareRevoke: $('#shareRevoke'),
    shareClose: $('#shareClose'),
    lightboxPrev: $('#lightboxPrev'),
    lightboxNext: $('#lightboxNext'),
    lightboxClose: $('#lightboxClose'),
    groupModal: $('#groupModal'),
    groupModalTitle: $('#groupModalTitle'),
    groupName: $('#groupName'),
    groupError: $('#groupError'),
    groupSave: $('#groupSave'),
    groupCancel: $('#groupCancel'),
    toasts: $('#toasts'),
    userButton: $('#userButton'),
    userMenu: $('#userMenu'),
    userName: $('#userName'),
    userSince: $('#userSince'),
    logoutButton: $('#logoutButton'),
  };

  const state = {
    images: [],
    groups: [],
    shares: [],
    view: 'all',
    groupId: null,
    query: '',
    lightboxIndex: -1,
  };

  const MAX_FILES = 20;
  const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  const FOLDER_SVG =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h3l2 2.5h6A2.5 2.5 0 0 1 20 10v7.5A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z"/>' +
    '</svg>';

  /* ---------- Utilitaires ---------- */

  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    if (response.status === 401) {
      window.location.assign('/login');
      throw new Error('Session expirée.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Une erreur est survenue.');
    return data;
  }

  function sendJson(url, method, body) {
    return api(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function toast(message, kind = 'info') {
    const node = document.createElement('div');
    node.className = `toast${kind === 'error' ? ' error' : ''}`;
    node.textContent = message;
    el.toasts.append(node);
    setTimeout(() => {
      node.style.opacity = '0';
      node.style.transition = 'opacity .25s ease';
      setTimeout(() => node.remove(), 260);
    }, 3600);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} o`;
    const units = ['ko', 'Mo', 'Go'];
    let value = bytes / 1024;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }
    return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[index]}`;
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
  }

  function copyText(value) {
    if (!value) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(value)
        .then(() => toast('Lien copié dans le presse-papiers.'))
        .catch(() => toast('Copie impossible : sélectionnez le lien à la main.', 'error'));
      return;
    }
    toast('Sélectionnez le lien pour le copier.', 'error');
  }

  const groupById = (id) => state.groups.find((group) => group.id === id) || null;

  /* ---------- Barre latérale ---------- */

  function buildGroupItem(group) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'side-item';
    button.dataset.group = String(group.id);
    button.title = group.name;
    button.innerHTML = FOLDER_SVG;

    const name = document.createElement('span');
    name.className = 'side-name';
    name.textContent = group.name;

    const count = document.createElement('span');
    count.className = 'side-count';
    count.textContent = String(group.image_count ?? 0);

    button.append(name, count);
    return button;
  }

  function renderSidebar() {
    const ungrouped = state.images.filter((image) => !image.group_id).length;
    el.countAll.textContent = String(state.images.length);
    el.countUngrouped.textContent = String(ungrouped);
    el.countShared.textContent = String(state.images.filter((image) => image.share).length);

    el.groupList.replaceChildren(...state.groups.map(buildGroupItem));
    el.groupEmpty.hidden = state.groups.length > 0;
    applyActiveView();
  }

  function applyActiveView() {
    el.viewList.querySelectorAll('.side-item').forEach((item) => {
      item.classList.toggle('is-active', state.view === 'all' && item.dataset.view === 'all');
      item.classList.toggle(
        'is-active',
        state.view === 'ungrouped' && item.dataset.view === 'ungrouped'
      );
    });
    el.groupList.querySelectorAll('.side-item').forEach((item) => {
      item.classList.toggle(
        'is-active',
        state.view === 'group' && Number(item.dataset.group) === state.groupId
      );
    });
    const sharedButton = document.querySelector('.side-item[data-view="shared"]');
    sharedButton?.classList.toggle('is-active', state.view === 'shared');
  }

  /* ---------- Vues ---------- */

  function viewTitle() {
    if (state.view === 'ungrouped') return 'Non classées';
    if (state.view === 'group') return groupById(state.groupId)?.name || 'Groupe';
    if (state.view === 'shared') return 'Partages actifs';
    return 'Toutes les images';
  }

  function currentImages() {
    if (state.view === 'ungrouped') return state.images.filter((image) => !image.group_id);
    if (state.view === 'group') {
      return state.images.filter((image) => image.group_id === state.groupId);
    }
    return state.images;
  }

  function setView(view, groupId = null) {
    state.view = view;
    state.groupId = groupId;
    state.query = '';
    el.search.value = '';
    el.searchWrap.hidden = view === 'shared';
    el.galleryView.hidden = view === 'shared';
    el.sharedView.hidden = view !== 'shared';
    el.groupTools.hidden = view !== 'group';
    el.viewTitle.textContent = viewTitle();

    applyActiveView();
    updateDropzoneHint();
    render();
    if (view === 'shared') loadShares().catch((error) => toast(error.message, 'error'));
  }

  function updateDropzoneHint() {
    const group = state.view === 'group' ? groupById(state.groupId) : null;
    el.dzHint.textContent = group
      ? `Les images ajoutées iront dans le groupe « ${group.name} ».`
      : 'Sans groupe sélectionné, les images arrivent dans « Non classées ».';
  }

  /* ---------- Rendu de la galerie ---------- */

  function createCard(image, index) {
    const figure = document.createElement('figure');
    figure.className = 'thumb';

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'thumb-open';
    open.setAttribute('aria-label', `Agrandir ${image.name}`);

    const img = document.createElement('img');
    img.src = image.url;
    img.alt = image.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    open.append(img);
    open.addEventListener('click', () => openLightbox(index));

    const group = image.group_id ? groupById(image.group_id) : null;
    if (group && state.view !== 'group') {
      const chip = document.createElement('span');
      chip.className = 'thumb-group';
      chip.textContent = group.name;
      chip.title = `Groupe : ${group.name}`;
      figure.append(chip);
    }

    const share = document.createElement('button');
    share.type = 'button';
    share.className = `thumb-btn${image.share ? ' is-shared' : ''}`;
    share.title = image.share ? 'Partagée — gérer le lien' : 'Partager par lien';
    share.setAttribute('aria-label', image.share ? `Gérer le partage de ${image.name}` : `Partager ${image.name}`);
    share.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M10 13.5a4 4 0 0 0 5.7.4l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7"/>' +
      '<path d="M14 10.5a4 4 0 0 0-5.7-.4l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7"/></svg>';
    share.addEventListener('click', (event) => {
      event.stopPropagation();
      openShare(image);
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'thumb-btn danger';
    remove.setAttribute('aria-label', `Supprimer ${image.name}`);
    remove.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      deleteImage(image);
    });

    const actions = document.createElement('div');
    actions.className = 'thumb-actions';
    actions.append(share, remove);

    const caption = document.createElement('figcaption');
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = image.name;
    name.title = image.name;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${formatSize(image.size)} · ${formatDate(image.created_at)}`;
    caption.append(name, meta);

    figure.append(open, actions, caption);
    return figure;
  }

  function render() {
    if (state.view === 'shared') {
      el.count.textContent = state.shares.length
        ? `${state.shares.length} lien${state.shares.length > 1 ? 's' : ''} actif${state.shares.length > 1 ? 's' : ''}`
        : '';
      return;
    }

    const base = currentImages();
    const query = state.query.trim().toLowerCase();
    state.visible = query
      ? base.filter((image) => image.name.toLowerCase().includes(query))
      : [...base];

    el.grid.replaceChildren(...state.visible.map(createCard));

    if (state.view === 'group') {
      el.count.textContent = `${state.visible.length} image${state.visible.length > 1 ? 's' : ''} dans ce groupe`;
    } else if (state.view === 'ungrouped') {
      el.count.textContent = `${state.visible.length} image${state.visible.length > 1 ? 's' : ''}`;
    } else {
      el.count.textContent = state.images.length
        ? `${state.visible.length} / ${state.images.length} image${state.images.length > 1 ? 's' : ''}`
        : '';
    }

    if (state.visible.length) {
      el.empty.hidden = true;
      return;
    }

    el.empty.hidden = false;
    if (state.images.length && query) {
      el.emptyTitle.textContent = 'Aucun résultat';
      el.emptyText.textContent = `Aucune image ne correspond à « ${state.query.trim()} ».`;
    } else if (state.view === 'group') {
      el.emptyTitle.textContent = 'Ce groupe est vide';
      el.emptyText.textContent =
        'Déposez des images ici : elles seront ajoutées directement à ce groupe.';
    } else if (state.view === 'ungrouped') {
      el.emptyTitle.textContent = 'Tout est rangé';
      el.emptyText.textContent = 'Chaque image appartient à un groupe.';
    } else {
      el.emptyTitle.textContent = "Aucune image pour l'instant";
      el.emptyText.textContent =
        'Ajoutez vos premières photos : elles sont rangées dans votre galerie privée.';
    }
  }

  /* ---------- Partages actifs ---------- */

  function createShareRow(share) {
    const row = document.createElement('article');
    row.className = 'share-card';

    const link = document.createElement('a');
    link.className = 'share-thumb';
    link.href = share.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `Ouvrir la page publique de ${share.image.name}`);
    const img = document.createElement('img');
    img.src = `/api/images/${share.image.id}/file`;
    img.alt = share.image.name;
    img.loading = 'lazy';
    link.append(img);

    const body = document.createElement('div');
    body.className = 'share-body';
    const title = document.createElement('strong');
    title.className = 'share-title';
    title.textContent = share.image.name;
    const meta = document.createElement('span');
    meta.className = 'share-meta';
    meta.textContent = [
      formatSize(share.image.size),
      `partagé le ${formatDate(share.shared_at)}`,
      share.image.group_name ? `groupe : ${share.image.group_name}` : 'non classée',
    ].join(' · ');

    const linkRow = document.createElement('div');
    linkRow.className = 'share-link';
    const input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.value = `${window.location.origin}${share.url}`;
    input.setAttribute('aria-label', `Lien de partage de ${share.image.name}`);
    input.addEventListener('focus', () => input.select());
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn';
    copy.textContent = 'Copier';
    copy.addEventListener('click', () => copyText(input.value));
    linkRow.append(input, copy);
    body.append(title, meta, linkRow);

    const actions = document.createElement('div');
    actions.className = 'share-actions';
    const open = document.createElement('a');
    open.className = 'btn btn-ghost';
    open.href = share.url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = 'Ouvrir';
    const revoke = document.createElement('button');
    revoke.type = 'button';
    revoke.className = 'btn btn-danger';
    revoke.textContent = 'Révoquer';
    revoke.addEventListener('click', () => revokeLink(share));
    actions.append(open, revoke);

    row.append(link, body, actions);
    return row;
  }

  function renderShares() {
    el.shareList.replaceChildren(...state.shares.map(createShareRow));
    el.sharedEmpty.hidden = state.shares.length > 0;
    el.shareList.hidden = state.shares.length === 0;
    render();
  }

  async function loadShares() {
    const { shares } = await api('/api/shares');
    state.shares = shares;
    renderShares();
  }

  async function revokeLink(share) {
    if (!window.confirm(`Révoquer le lien de « ${share.image.name} » ? Il ne fonctionnera plus.`)) {
      return;
    }
    try {
      await api(`/api/shares/${share.token}`, { method: 'DELETE' });
      state.shares = state.shares.filter((item) => item.token !== share.token);
      const local = state.images.find((image) => image.id === share.image.id);
      if (local) local.share = null;
      renderSidebar();
      renderShares();
      toast('Lien révoqué : la page publique ne répond plus.');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  /* ---------- Chargement ---------- */

  async function loadImages() {
    const [imagesData, groupsData] = await Promise.all([api('/api/images'), api('/api/groups')]);
    state.images = imagesData.images;
    state.groups = groupsData.groups;
    renderSidebar();
    syncGroupOptions();
    render();
  }

  /* ---------- envoi ---------- */

  function showProgress(percent, text) {
    el.uploadStatus.hidden = false;
    el.uploadFill.style.width = `${percent}%`;
    el.uploadText.textContent = text;
  }

  function hideProgress() {
    el.uploadStatus.hidden = true;
    el.uploadFill.style.width = '0%';
  }

  function uploadFiles(fileList) {
    const files = [...fileList].filter((file) => file.type.startsWith('image/'));
    if (!files.length) {
      toast('Choisissez des fichiers image (JPEG, PNG, WebP, GIF, AVIF).', 'error');
      return;
    }
    if (files.length > MAX_FILES) {
      toast(`${MAX_FILES} images maximum par envoi.`, 'error');
      return;
    }

    const targetGroupId = state.view === 'group' ? state.groupId : null;
    const form = new FormData();
    if (targetGroupId) form.append('groupId', String(targetGroupId));
    files.forEach((file) => form.append('files', file));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/images');
    showProgress(0, `Envoi de ${files.length} image${files.length > 1 ? 's' : ''}…`);

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      showProgress(percent, `Envoi ${percent}%`);
    });

    xhr.addEventListener('load', async () => {
      hideProgress();
      if (xhr.status === 401) {
        window.location.assign('/login');
        return;
      }
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        const added = data.images?.length ?? 0;
        const group = targetGroupId ? groupById(targetGroupId) : null;
        toast(
          `${added} image${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''}${group ? ` dans « ${group.name} »` : ''}.`
        );
        if (data.rejected?.length) {
          toast(`${data.rejected.length} fichier(s) ignoré(s) : contenu non reconnu.`, 'error');
        }
        await loadImages();
      } else {
        toast(data.error || "L'envoi a échoué.", 'error');
      }
    });

    xhr.addEventListener('error', () => {
      hideProgress();
      toast("L'envoi a échoué (connexion interrompue).", 'error');
    });

    xhr.send(form);
  }

  /* ---------- suppression ---------- */

  async function deleteImage(image) {
    if (!window.confirm(`Supprimer « ${image.name} » ? Cette action est définitive.`)) return;
    try {
      await api(`/api/images/${image.id}`, { method: 'DELETE' });
      state.images = state.images.filter((item) => item.id !== image.id);
      closeLightbox();
      renderSidebar();
      render();
      toast('Image supprimée.');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  /* ---------- visionneuse ---------- */

  function syncGroupOptions() {
    const options = [new Option('Non classée', '')];
    state.groups.forEach((group) => options.push(new Option(group.name, String(group.id))));
    const previous = el.lightboxGroup.value;
    el.lightboxGroup.replaceChildren(...options);
    if (previous) el.lightboxGroup.value = previous;
  }

  function openLightbox(index) {
    if (index < 0 || index >= state.visible.length) return;
    state.lightboxIndex = index;
    const image = state.visible[index];
    el.lightboxImage.src = image.url;
    el.lightboxImage.alt = image.name;
    el.lightboxName.textContent = image.name;
    el.lightboxMeta.textContent = `${formatSize(image.size)} · ${formatDate(image.created_at)}`;
    el.lightboxGroup.value = image.group_id ? String(image.group_id) : '';
    const multiple = state.visible.length > 1;
    el.lightboxPrev.hidden = !multiple;
    el.lightboxNext.hidden = !multiple;
    el.lightbox.hidden = false;
    lockScroll();
    el.lightboxClose.focus({ preventScroll: true });
  }

  function closeLightbox() {
    el.lightbox.hidden = true;
    el.lightboxImage.removeAttribute('src');
    state.lightboxIndex = -1;
    lockScroll();
  }

  function stepLightbox(direction) {
    if (state.lightboxIndex === -1) return;
    const total = state.visible.length;
    openLightbox((state.lightboxIndex + direction + total) % total);
  }

  async function moveLightboxImage(value) {
    const image = state.visible[state.lightboxIndex];
    if (!image) return;
    const groupId = value ? Number(value) : null;
    try {
      await api(`/api/images/${image.id}/group`, { method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      });
      image.group_id = groupId;
      const group = groupId ? groupById(groupId) : null;
      toast(group ? `Image déplacée dans « ${group.name} ».` : 'Image déplacée dans « Non classées ».');
      renderSidebar();
      render();
      const index = state.visible.findIndex((item) => item.id === image.id);
      if (index === -1) closeLightbox();
      else openLightbox(index);
    } catch (error) {
      toast(error.message, 'error');
      el.lightboxGroup.value = image.group_id ? String(image.group_id) : '';
    }
  }

  /* ---------- partage ---------- */

  let sharedImageId = null;
  let sharedToken = null;

  function lockScroll() {
    const open = !el.lightbox.hidden || !el.shareModal.hidden || !el.groupModal.hidden;
    document.body.style.overflow = open ? 'hidden' : '';
  }

  async function openShare(image) {
    try {
      const { share } = await api(`/api/images/${image.id}/share`, { method: 'POST' });
      sharedImageId = image.id;
      sharedToken = share.token;
      el.shareUrl.value = `${window.location.origin}/s/${share.token}`;
      el.shareModal.hidden = false;
      lockScroll();

      const local = state.images.find((item) => item.id === image.id);
      if (local) local.share = { token: share.token, url: share.url };
      renderSidebar();
      render();
      if (state.view === 'shared') loadShares().catch(() => {});

      requestAnimationFrame(() => {
        el.shareUrl.focus({ preventScroll: true });
        el.shareUrl.select();
      });
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function closeShare() {
    el.shareModal.hidden = true;
    sharedImageId = null;
    sharedToken = null;
    lockScroll();
  }

  async function copyShareLink() {
    copyText(el.shareUrl.value);
  }

  async function revokeShare() {
    if (!sharedToken) return;
    try {
      await api(`/api/shares/${sharedToken}`, { method: 'DELETE' });
      const local = state.images.find((item) => item.id === sharedImageId);
      if (local) local.share = null;
      state.shares = state.shares.filter((item) => item.token !== sharedToken);
      closeShare();
      renderSidebar();
      render();
      if (state.view === 'shared') renderShares();
      toast('Partage désactivé : le lien ne fonctionne plus.');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  /* ---------- groupes ---------- */

  let editingGroupId = null;

  function openGroupModal(group = null) {
    editingGroupId = group ? group.id : null;
    el.groupModalTitle.textContent = group ? 'Renommer le groupe' : 'Nouveau groupe';
    el.groupSave.textContent = group ? 'Enregistrer' : 'Créer le groupe';
    el.groupName.value = group ? group.name : '';
    el.groupError.hidden = true;
    el.groupError.textContent = '';
    el.groupModal.hidden = false;
    lockScroll();
    requestAnimationFrame(() => {
      el.groupName.focus();
      el.groupName.select();
    });
  }

  function closeGroupModal() {
    el.groupModal.hidden = true;
    editingGroupId = null;
    lockScroll();
  }

  async function saveGroup() {
    const name = el.groupName.value.trim().replace(/\s+/g, ' ');
    if (!name) {
      el.groupError.textContent = 'Donnez un nom au groupe.';
      el.groupError.hidden = false;
      el.groupName.focus();
      return;
    }

    el.groupSave.disabled = true;
    try {
      if (editingGroupId) {
        const { group } = await sendJson(`/api/groups/${editingGroupId}`, 'PATCH', { name });
        const local = groupById(group.id);
        if (local) local.name = group.name;
        state.groups.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        if (state.view === 'group' && state.groupId === group.id) {
          el.viewTitle.textContent = group.name;
        }
        toast('Groupe renommé.');
      } else {
        const { group } = await sendJson('/api/groups', 'POST', { name });
        state.groups.push({ ...group, image_count: 0 });
        state.groups.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        toast(`Groupe « ${group.name} » créé.`);
        closeGroupModal();
        await loadImages();
        setView('group', group.id);
        return;
      }
      closeGroupModal();
      await loadImages();
    } catch (error) {
      el.groupError.textContent = error.message;
      el.groupError.hidden = false;
    } finally {
      el.groupSave.disabled = false;
    }
  }

  async function deleteCurrentGroup() {
    const group = state.view === 'group' ? groupById(state.groupId) : null;
    if (!group) return;
    if (
      !window.confirm(
        `Supprimer le groupe « ${group.name} » ? Les images ne sont pas supprimées, elles redeviennent non classées.`
      )
    ) {
      return;
    }
    try {
      await api(`/api/groups/${group.id}`, { method: 'DELETE' });
      state.groups = state.groups.filter((item) => item.id !== group.id);
      state.images.forEach((image) => {
        if (image.group_id === group.id) image.group_id = null;
      });
      toast('Groupe supprimé.');
      await loadImages();
      setView('all');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  /* ---------- menu utilisateur ---------- */

  function setMenu(open) {
    el.userMenu.hidden = !open;
    el.userButton.setAttribute('aria-expanded', String(open));
  }

  /* ---------- événements ---------- */

  el.search.addEventListener('input', () => {
    state.query = el.search.value;
    render();
  });

  el.dropzone.addEventListener('click', () => el.fileInput.click());
  el.dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      el.fileInput.click();
    }
  });
  el.uploadTrigger.addEventListener('click', () => el.fileInput.click());

  el.fileInput.addEventListener('change', () => {
    if (el.fileInput.files.length) uploadFiles(el.fileInput.files);
    el.fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach((type) => {
    el.dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      el.dropzone.classList.add('dragging');
    });
  });

  ['dragleave', 'dragend'].forEach((type) => {
    el.dropzone.addEventListener(type, () => el.dropzone.classList.remove('dragging'));
  });

  el.dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    el.dropzone.classList.remove('dragging');
    if (event.dataTransfer?.files?.length) uploadFiles(event.dataTransfer.files);
  });

  document.addEventListener('dragover', (event) => event.preventDefault());
  document.addEventListener('drop', (event) => event.preventDefault());

  el.viewList.addEventListener('click', (event) => {
    const button = event.target.closest('.side-item');
    if (!button) return;
    setView(button.dataset.view === 'ungrouped' ? 'ungrouped' : 'all');
  });

  el.groupList.addEventListener('click', (event) => {
    const button = event.target.closest('.side-item');
    if (!button) return;
    setView('group', Number(button.dataset.group));
  });

  document.querySelector('.side-item[data-view="shared"]').addEventListener('click', () => {
    setView('shared');
  });

  el.newGroup.addEventListener('click', () => openGroupModal());
  el.renameGroup.addEventListener('click', () => {
    const group = groupById(state.groupId);
    if (group) openGroupModal(group);
  });
  el.deleteGroup.addEventListener('click', deleteCurrentGroup);
  el.groupSave.addEventListener('click', saveGroup);
  el.groupCancel.addEventListener('click', closeGroupModal);
  el.groupModal.addEventListener('click', (event) => {
    if (event.target === el.groupModal) closeGroupModal();
  });
  el.groupName.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveGroup();
    }
  });

  el.lightboxClose.addEventListener('click', closeLightbox);
  el.lightboxPrev.addEventListener('click', () => stepLightbox(-1));
  el.lightboxNext.addEventListener('click', () => stepLightbox(1));
  el.lightbox.addEventListener('click', (event) => {
    if (event.target === el.lightbox) closeLightbox();
  });
  el.lightboxDelete.addEventListener('click', () => {
    const image = state.visible[state.lightboxIndex];
    if (image) deleteImage(image);
  });
  el.lightboxShare.addEventListener('click', () => {
    const image = state.visible[state.lightboxIndex];
    if (image) openShare(image);
  });
  el.lightboxGroup.addEventListener('change', () => moveLightboxImage(el.lightboxGroup.value));

  el.shareCopy.addEventListener('click', copyShareLink);
  el.shareRevoke.addEventListener('click', revokeShare);
  el.shareClose.addEventListener('click', closeShare);
  el.shareModal.addEventListener('click', (event) => {
    if (event.target === el.shareModal) closeShare();
  });

  el.userButton.addEventListener('click', (event) => {
    event.stopPropagation();
    setMenu(el.userMenu.hidden);
  });

  document.addEventListener('click', (event) => {
    if (!el.userMenu.hidden && !el.userMenu.contains(event.target)) setMenu(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!el.groupModal.hidden) closeGroupModal();
      else if (!el.shareModal.hidden) closeShare();
      else if (!el.lightbox.hidden) closeLightbox();
      setMenu(false);
    } else if (!el.lightbox.hidden) {
      if (event.key === 'ArrowRight') stepLightbox(1);
      if (event.key === 'ArrowLeft') stepLightbox(-1);
    }
  });

  el.logoutButton.addEventListener('click', async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      /* on redirige quand même */
    }
    window.location.assign('/login');
  });

  /* ---------- démarrage ---------- */

  (async () => {
    try {
      const { user } = await api('/api/auth/me');
      el.userName.textContent = user.username;
      el.userButton.textContent = user.username.slice(0, 1);
      const since = formatDate(user.created_at);
      el.userSince.textContent = since ? `Membre depuis le ${since}` : '';
      el.userButton.setAttribute('aria-label', `Menu du compte de ${user.username}`);
      updateDropzoneHint();
      await loadImages();
    } catch (error) {
      toast(error.message, 'error');
    }
  })();
})();
