const BATCH_SIZE = 400;

function exportDriveTreeStylish() {
  const startFolderId = null; // ou "ID_DU_DOSSIER" pour une branche précise
  const ss = SpreadsheetApp.create("Arbo (stylée & groupée) - " +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"));

  const root = startFolderId ? DriveApp.getFolderById(startFolderId) : DriveApp.getRootFolder();

  // Feuille Résumé
  const shSummary = ss.getActiveSheet();
  shSummary.setName("Résumé");
  renderSummaryHeader_(shSummary);

  // Dossiers de 1er niveau
  const topFolders = [];
  const it = root.getFolders();
  while (it.hasNext()) topFolders.push(it.next());

  let totalFolders = 0, totalFiles = 0;

  for (const top of topFolders) {
    const sheetName = trimSheetName_("📁 " + top.getName());
    const sh = ss.insertSheet(sheetName);
    const headers = ["Niveau","Type","TypeOrdre","Hiérarchie","Nom","Lien","Taille (lisible)","Dernière modif","Drive"];
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);

    const ctx = { sheet: sh, rows: [], nextRow: 2 };
    const counters = { folders: 0, files: 0 };

    // racine locale = dossier top (lien = ouvrir le dossier)
    const topLink = `https://drive.google.com/drive/folders/${top.getId()}`;
    addRowStylish_(ctx, [0,"Dossier",0, iconFolder_(0) + top.getName(), top.getName(), topLink, "", fmtDate_(top.getLastUpdated()), "Mon Drive"], true);
    counters.folders++;
    traverseInto_DFS_(top, 0, ctx, counters); // DFS: dossiers parent → fichiers → sous-dossiers
    flushStylish_(ctx);

    // mise en forme (sans tri)
    styleSheet_NoSort_(sh);
    colorizeFoldersByDepth_(sh);      // couleurs par niveau
    groupHierarchy_(sh);              // groupes pliables par dossier

    totalFolders += counters.folders;
    totalFiles += counters.files;
  }

  // Fichiers directement à la racine de Mon Drive
  const rootFiles = [];
  const rf = root.getFiles();
  while (rf.hasNext()) rootFiles.push(rf.next());
  if (rootFiles.length) {
    const sh = ss.insertSheet("📁 (Racine: fichiers)");
    const headers = ["Niveau","Type","TypeOrdre","Hiérarchie","Nom","Lien","Taille (lisible)","Dernière modif","Drive"];
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);

    const ctx = { sheet: sh, rows: [], nextRow: 2 };
    for (const f of rootFiles) {
      // pas de parent (on est à la racine) → on ouvre la racine (fallback) avec sélection
      let link = "";
      try {
        const parents = f.getParents();
        if (parents.hasNext()) {
          const p = parents.next();
          link = `https://drive.google.com/drive/folders/${p.getId()}?selected=${f.getId()}`;
        } else {
          link = `https://drive.google.com/drive/my-drive?selected=${f.getId()}`;
        }
      } catch (e) {
        link = `https://drive.google.com/drive/search?q=${encodeURIComponent(f.getName())}`;
      }
      addRowStylish_(ctx, [
        0,"Fichier",1, iconFile_(0) + f.getName(), f.getName(),
        link, humanSize_(f.getSize()), fmtDate_(f.getLastUpdated()), "Mon Drive"
      ], false);
    }
    flushStylish_(ctx);
    styleSheet_NoSort_(sh);
  }

  // Résumé
  fillSummary_(shSummary, topFolders, totalFolders, totalFiles);

  Logger.log("Prêt : " + ss.getUrl());
}

/* ---------- Parcours DFS qui garde les fichiers sous leur dossier ---------- */
function traverseInto_DFS_(folder, depth, ctx, counters) {
  // 1) FICHIERS d'abord (restent sous le dossier)
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    // lien = ouvrir le dossier parent avec le fichier sélectionné
    let link = "";
    try {
      const parents = f.getParents();
      if (parents.hasNext()) {
        const parent = parents.next();
        link = `https://drive.google.com/drive/folders/${parent.getId()}?selected=${f.getId()}`;
      } else {
        link = `https://drive.google.com/drive/my-drive?selected=${f.getId()}`;
      }
    } catch (e) {
      link = `https://drive.google.com/drive/search?q=${encodeURIComponent(f.getName())}`;
    }

    addRowStylish_(ctx, [
      depth + 1, "Fichier", 1, iconFile_(depth + 1) + f.getName(), f.getName(),
      link, humanSize_(f.getSize()), fmtDate_(f.getLastUpdated()), "Mon Drive"
    ], false);
    counters.files++;
  }

  // 2) SOUS-DOSSIERS ensuite (chaque dossier est suivi de ses fichiers, etc.)
  const subs = folder.getFolders();
  while (subs.hasNext()) {
    const sub = subs.next();
    const subLink = `https://drive.google.com/drive/folders/${sub.getId()}`; // ouvrir le dossier
    addRowStylish_(ctx, [
      depth + 1, "Dossier", 0, iconFolder_(depth + 1) + sub.getName(), sub.getName(),
      subLink, "", fmtDate_(sub.getLastUpdated()), "Mon Drive"
    ], true);
    counters.folders++;
    traverseInto_DFS_(sub, depth + 1, ctx, counters);
  }

  if (ctx.rows.length >= BATCH_SIZE) flushStylish_(ctx);
}

/* ---------- Buffer + Lien (utilise l'URL déjà calculée) ---------- */
function addRowStylish_(ctx, row, isFolder) {
  ctx.rows.push(row);
  if (ctx.rows.length >= BATCH_SIZE) flushStylish_(ctx);
}
function flushStylish_(ctx) {
  if (!ctx.rows.length) return;
  const sh = ctx.sheet;
  const start = ctx.nextRow;
  const w = ctx.rows[0].length;
  sh.getRange(start, 1, ctx.rows.length, w).setValues(ctx.rows);

  // Colonne "Lien" : on a déjà l'URL exacte en colonne 6 → on pose la formule HYPERLINK
  const linkCol = 6;
  for (let r = 0; r < ctx.rows.length; r++) {
    const url = ctx.rows[r][5];
    if (url) {
      sh.getRange(start + r, linkCol).setFormula(`=HYPERLINK("${url}","Ouvrir emplacement")`);
    }
  }

  ctx.nextRow += ctx.rows.length;
  ctx.rows = [];
}

/* ---------- Mise en forme (sans tri) ---------- */
function styleSheet_NoSort_(sh) {
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  // Cacher la colonne technique TypeOrdre (C)
  sh.hideColumns(3);

  // En-tête
  const header = sh.getRange(1,1,1,lastCol);
  header.setBackground("#1f2937").setFontColor("#ffffff").setFontWeight("bold");

  // Bandes alternées hors en-tête
  if (lastRow > 1) {
    sh.getRange(2,1,lastRow-1,lastCol).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  }

  // Largeurs
  sh.setColumnWidths(1, 1, 70);   // Niveau
  sh.setColumnWidths(2, 1, 90);   // Type
  sh.setColumnWidths(4, 1, 420);  // Hiérarchie
  sh.setColumnWidths(5, 1, 260);  // Nom
  sh.setColumnWidths(6, 1, 150);  // Lien
  sh.setColumnWidths(7, 1, 120);  // Taille (lisible)
  sh.setColumnWidths(8, 1, 160);  // Dernière modif
  sh.setColumnWidths(9, 1, 160);  // Drive

  // Wrap sur Hiérarchie
  if (lastRow > 1) sh.getRange(2,4,lastRow-1,1).setWrap(true);

  // Formats
  if (lastRow > 1) {
    sh.getRange(2,7,lastRow-1,1).setNumberFormat("@");
    sh.getRange(2,8,lastRow-1,1).setNumberFormat("yyyy-mm-dd hh:mm");
  }
}

/* ---------- Couleurs par niveau de dossier + gras ---------- */
function colorizeFoldersByDepth_(sh) {
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) return;

  const types = sh.getRange(2,2,lastRow-1,1).getValues(); // B
  const levels = sh.getRange(2,1,lastRow-1,1).getValues(); // A
  const bg = sh.getRange(2,1,lastRow-1,sh.getLastColumn()).getBackgrounds();

  for (let i = 0; i < types.length; i++) {
    const isFolder = types[i][0] === "Dossier";
    const lvl = Number(levels[i][0]) || 0;
    if (isFolder) {
      const color = colorForDepth_(lvl);
      for (let c = 1; c <= sh.getLastColumn(); c++) bg[i][c-1] = color;
    }
  }
  sh.getRange(2,1,lastRow-1,sh.getLastColumn()).setBackgrounds(bg);

  // Hiérarchie en gras pour les dossiers
  const hier = sh.getRange(2,4,lastRow-1,1);
  const fonts = hier.getFontWeights();
  for (let i = 0; i < types.length; i++) {
    fonts[i][0] = (types[i][0] === "Dossier") ? "bold" : "normal";
  }
  hier.setFontWeights(fonts);
}

function colorForDepth_(depth) {
  switch (depth) {
    case 0: return "#dbeafe"; // racine
    case 1: return "#e0f2fe";
    case 2: return "#e0e7ff";
    case 3: return "#fce7f3";
    case 4: return "#fef3c7";
    default: return "#f3f4f6";
  }
}

/* ---------- Groupes pliables par dossier (post-traitement) ---------- */
function groupHierarchy_(sh) {
  const lastRow = sh.getLastRow();
  if (lastRow <= 2) return;

  const levels = sh.getRange(2,1,lastRow-1,1).getValues().map(r => Number(r[0]) || 0);
  const types  = sh.getRange(2,2,lastRow-1,1).getValues().map(r => String(r[0]));
  // On scanne les lignes et crée un groupe pour chaque dossier qui englobe ses enfants
  const stack = []; // [{depth, startRow}] sur base 2..lastRow
  for (let i = 0; i < levels.length; i++) {
    const row = i + 2;
    const depth = levels[i];
    const type = types[i];

    // fermer les groupes dont la profondeur >= depth (on remonte)
    while (stack.length && stack[stack.length-1].depth >= depth) {
      const grp = stack.pop();
      const start = grp.startRow + 1; // enfants commencent après la ligne du dossier
      const end = row - 1;
      if (end >= start) {
        sh.getRange(start, 1, end - start + 1, 1).shiftRowGroupDepth(1);
      }
    }
    // ouvrir un nouveau groupe si dossier
    if (type === "Dossier") {
      stack.push({ depth, startRow: row });
    }
  }
  // fermer les groupes restants jusqu'à la fin
  if (stack.length) {
    const lastDataRow = lastRow;
    while (stack.length) {
      const grp = stack.pop();
      const start = grp.startRow + 1;
      const end = lastDataRow;
      if (end >= start) {
        sh.getRange(start, 1, end - start + 1, 1).shiftRowGroupDepth(1);
      }
    }
  }

  // optionnel : plier par défaut les niveaux > 1
  sh.collapseAllRowGroups();
}

/* ---------- Résumé & utils (identique) ---------- */
function renderSummaryHeader_(sh) {
  sh.clear();
  sh.getRange(1,1,1,4).setValues([["Section","Valeur","Note","Lien"]]);
  sh.setFrozenRows(1);
  sh.getRange(1,1,1,4).setBackground("#1f2937").setFontColor("#ffffff").setFontWeight("bold");
  sh.setColumnWidths(1,1,160);
  sh.setColumnWidths(2,1,240);
  sh.setColumnWidths(3,1,420);
  sh.setColumnWidths(4,1,260);
}
function fillSummary_(sh, topFolders, totalFolders, totalFiles) {
  const rows = [];
  rows.push(["Dossiers (total)", totalFolders, "Tous niveaux", ""]);
  rows.push(["Fichiers (total)", totalFiles, "", ""]);
  rows.push(["Dossiers racine", topFolders.length, "Un onglet par dossier", ""]);

  const ss = sh.getParent();
  for (const f of topFolders) {
    const name = trimSheetName_("📁 " + f.getName());
    const gid = ss.getSheetByName(name).getSheetId();
    rows.push(["Feuille", name, "Accès direct", `=HYPERLINK("#gid=${gid}","Ouvrir ${name}")`]);
  }
  if (rows.length) sh.getRange(2,1,rows.length,4).setValues(rows);
}
function iconFolder_(depth) { return (depth > 0 ? "  ".repeat(depth) : "") + "📁 "; }
function iconFile_(depth)   { return (depth > 0 ? "  ".repeat(depth) : "") + "📄 "; }
function fmtDate_(d)        { return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm") : ""; }
function humanSize_(bytes)  {
  if (!bytes || bytes <= 0) return "";
  const units = ["octets","Ko","Mo","Go","To","Po"];
  let u = 0, n = bytes;
  while (n >= 1024 && u < units.length-1) { n /= 1024; u++; }
  return (Math.round(n*10)/10) + " " + units[u];
}
function trimSheetName_(s) { s = s.replace(/[\\/?*\[\]]/g, " "); return s.length > 100 ? s.slice(0,100) : s; }
