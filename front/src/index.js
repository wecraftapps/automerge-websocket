import { io } from 'socket.io-client'
import * as Automerge from '@automerge/automerge';

let socket = null
let doc = Automerge.init()
let actorId = Automerge.getActorId(doc);
let serverSyncState = Automerge.initSyncState();
let isOnline = true;

/**
 * Updates the local document and refreshes the DOM to display the content of the new document
 * 
 * If client is ONLINE, check if it's needed to share document with the server
 * 
 * @param {*} newDoc New version of the document
 */
function updateDoc(newDoc) {
  doc = newDoc
  render(newDoc)

  if (isOnline) syncProtocol();
}

/**
 * Function to add an item to the todo-list
 * source : https://automerge.org/docs/tutorial/make-a-change/
 * 
 * @param {*} text Text of the item to add
 */
function addItem(text) {
  let newDoc = Automerge.change(doc, doc => {
    if (!doc.items) doc.items = []
    doc.items.push({ text, done: false })
  })

  updateDoc(newDoc)
}

/**
 * Function to toggle an item on the todo-list and cross-out the item
 * source : https://automerge.org/docs/tutorial/rendering-app/#exercise
 * 
 * @param {*} index Index of the item to cross-out
 */
function toggle(index) {
  let newDoc = Automerge.change(doc, (doc) => {
    doc.items[index].done = !doc.items[index].done
  })

  updateDoc(newDoc)
}

/**
 * Function to update the DOM and display the content of a document
 * source : https://automerge.org/docs/tutorial/rendering-app/
 * 
 * @param {*} doc Automerge document to display in the DOM
 */
function render(doc) {
  let list = document.querySelector("#todo-list")
  list.innerHTML = ''
  doc.items && doc.items.forEach((item, index) => {
    let itemEl = document.createElement('li')
    itemEl.innerText = item.text
    itemEl.onclick = () => toggle(index)
    itemEl.style = item.done ? 'text-decoration: line-through' : ''
    list.appendChild(itemEl)
  })
}

/**
 * Function to initialize
 * - the websocket connection
 * - the interactivity in the DOM
 */
const init = async () => {
  // Init connection to the WebSocket server
  socket = io('ws://localhost:5010');

  socket.on('connect', () => {
    console.log(`*** ON CONNECT ***`);

    // Starting Sync Protocol to get the latest version of the document
    syncProtocol();
  });

  socket.on('UPDATE_SYNC_STATE', (data) => {
    if (!isOnline) return;

    // Update sync protocol
    const change = convertDataURIToBinary(data.syncMessage);

    const [nextDoc, nextSyncState, patch] = Automerge.receiveSyncMessage(
      doc,
      serverSyncState,
      change,
    );

    doc = nextDoc;
    serverSyncState = nextSyncState;

    syncProtocol();
    render(nextDoc);
  });

  // There we need a Timeout to wait the DOM to finish initializing
  setTimeout(() => {
    // source : https://automerge.org/docs/tutorial/make-a-change/
    let form = document.querySelector('form')
    let input = document.querySelector('#new-todo')
    form.onsubmit = (ev) => {
      ev.preventDefault()
      addItem(input.value)
      input.value = null
    }

    // Add interactivity to the toggle for the online status
    let toggleOnlineBtn = document.querySelector('#toggle-online-btn');
    toggleOnlineBtn.onclick = () => {
      isOnline = !isOnline;

      let onlineText = document.querySelector('#online-text');
      onlineText.innerHTML = isOnline ? 'ONLINE' : 'OFFLINE';

      if (isOnline) {
        syncProtocol();
      }
    }
  }, 1000);
}

init();

/**
 * Function to convert Uint8Array to base64
 * @param {*} arr 
 * @returns 
 */
const uint8ToBase64 = (arr) =>
    btoa(
        Array(arr.length)
            .fill('')
            .map((_, i) => String.fromCharCode(arr[i]))
            .join('')
    );

/**
 * Function to convert base64 to Uint8Array
 * @param {*} dataURI 
 * @returns 
 */
const convertDataURIToBinary = (dataURI) => {
  const raw = atob(dataURI);
  const rawLength = raw.length;
  const array = new Uint8Array(new ArrayBuffer(rawLength));

  for(let i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}

/**
 * Function to send a synchronisation message to the server to check if we need updates if our document is not in sync with the one on the server
 */
const syncProtocol = () => {
  const [nextSyncState, syncMessage] = Automerge.generateSyncMessage(
    doc,
    serverSyncState,
  );

  if (syncMessage) {
    const b64 = uint8ToBase64(syncMessage);

    socket.emit('CLIENT_SYNC', {
      actorId,
      syncMessage: b64,
    });
  }

  serverSyncState = nextSyncState;
};
