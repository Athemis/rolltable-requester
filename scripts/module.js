const MODULE_NAME = 'rolltable-requester';
const TEMPLATE_PATH = `/modules/${MODULE_NAME}/templates`;
const WHISPER_FN = 'cheekyWhisper';

let socket;

async function rolltableRequesterMakeRoll(table) {
  const { formula } = table.data;
  const pRoll = new Roll(formula);
  const die = await pRoll.roll({ async: true });
  await pRoll.toMessage({}, {
    rollMode: CONFIG.Dice.rollModes.publicroll,
    create: true,
  });

  const results = table.getResultsForRoll(die.total);
  const thanks = game.i18n.localize('RolltableRequester.PlayerThanks');
  const user = thanks.replace(/\[PLAYER\]/g, game.user.name);
  const myHtml = await renderTemplate(`${TEMPLATE_PATH}/result-card.html`, {
    name: table.name,
    thumbnail: table.thumbnail,
    total: die.total,
    user,
    content: results[0].data.text
  });
  const drawChatData = {
      content: myHtml,
  };
  await socket.executeAsGM(WHISPER_FN, drawChatData);
}

async function makeRollById(tid) {
  const table = game.tables.get(tid);
  rolltableRequesterMakeRoll(table);
}

async function makeRollByName(tableName) {
  const table = game.tables.getName(tableName);
  rolltableRequesterMakeRoll(table);
}

async function requestRollById(tid, { blind } = { blind: false }) {
  const tmplData = {
    name: '???',
    thumbnail: 'icons/svg/d20-grey.svg',
    tid,
  };
  let table;
  if (!blind) {
    table = game.tables.get(tid);
    tmplData.name = table.name;
    tmplData.thumbnail = table.thumbnail;
  }
  const myHtml = await renderTemplate(`${TEMPLATE_PATH}/request-card.html`, tmplData);
  const chatData = {
    user: game.user.id,
    content: myHtml
  };
  ChatMessage.create(chatData, {});
  return table;
}

async function requestRollByName(tableName, opts = { blind: false }) {
  const table = game.tables.getName(tableName);
  return await requestRollById(table.id, opts);
}

function cheekyWhisper(msg) {
  const chatMsg = {
    ...msg,
    whisper: ChatMessage.getWhisperRecipients('GM'),
  }
  ChatMessage.create(chatMsg);
}

Hooks.once('init', async function() {
  globalThis.RolltableRequester = {
    requestRollById,
    requestRollByName,
    makeRollById,
    makeRollByName,
  }
});

Hooks.once('socketlib.ready', () => {
  socket = socketlib.registerModule(MODULE_NAME);
  socket.register(WHISPER_FN, cheekyWhisper);
});

Hooks.once('ready', async function() {
  $(document).on('click.rolltable-requester', '.rt-requester', function() {
    console.log('RR: Handling button click');
    const c = $(this);
    const tid = c.data('tableid');
    makeRollById(tid);
  });
});

Hooks.on('getRollTableDirectoryEntryContext', async function(_, entries) {
  const requestNamedRoll = 'Request Named Roll';
  if (entries.some(e => e.name === requestNamedRoll)) {
    return;
  }
  // Add entries at the top.
  entries.unshift({
    name: 'Make Roll',
    icon: '<i class="fas fa-dice-d20"></i>',
    callback: (target) => makeRollById(target.data('document-id')),
  }, {
    name: requestNamedRoll,
    icon: '<i class="fas fa-question-circle"></i>',
    condition: game.user.isGM,
    callback: (target) => requestRollById(target.data('document-id')),
  }, {
    name: 'Request Blinded Roll',
    icon: '<i class="fas fa-eye-slash"></i>',
    condition: game.user.isGM,
    callback: (target) => requestRollById(target.data('document-id'), { blind: true }),
  });
});
