/*
 * vars
 */

// API

let clientID = "16dcb564d8274f44a41c86b4093c5d02"; // please create your own Spotify ID when using this project (https://developer.spotify.com/dashboard)
let redirectURL = "https://aririos.com/spot-m3u";

if (location.hostname == "localhost" || location.hostname == "127.0.0.1") {
    redirectURL = "http://127.0.0.1:8000/public/";
}

// elements

let loginBtn = document.getElementById("login");
let playlistsSecCont = document.getElementById("playlists");
let progress = document.getElementById("progress");
let downloadA = document.getElementById("download-a");
let downloadBtn = document.getElementById("download-btn");

/*
 * dev logging
 */

function clog(message, level = 0) {
    switch (level) {
        case 1:
            console.log(message);
            // console.log("%c" + message, "color: hsl(240, 69%, 49%)");
            break;
        case 2:
            console.warn(message);
            // console.log("%c" + message, "color: hsl(147, 69%, 49%)");
            break;
        case 3:
            console.error(message);
            // console.log("%c" + message, "color: hsl(0, 100%, 50%)");
            break;
        default:
            console.log(message);
            break;
    }
}

/*
 * request access token
 */

const generateRandomString = (length) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  }
  
const codeVerifier = generateRandomString(64);
const sha256 = async(plain) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
}

const base64encode = (input) => {
return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// login btn behavior
loginBtn.addEventListener("click", async function() {
    clog("Logging in...", 1);
    let scopes = "playlist-read-private";

    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);

    // generated in the previous step
    window.localStorage.setItem('code_verifier', codeVerifier);

    // request access token
    window.location = 
        'https://accounts.spotify.com/authorize?client_id=' + encodeURIComponent(clientID) + 
        '&response_type=code' +
        (scopes ? "&scope=" + encodeURIComponent(scopes) : "")+
        '&redirect_uri=' + encodeURIComponent(redirectURL) +
        '&code_challenge_method=S256' + 
        '&code_challenge=' + encodeURIComponent(codeChallenge);
});

/*
 * login
 */

// get code from URL
let code = "";
try {
    const urlParams = new URLSearchParams(window.location.search);
    code = urlParams.get('code');
} catch (error) {
    code = ""
}

// login
if (code) {
    const getToken = async code => {

        // stored in the previous step
        const codeVerifier = localStorage.getItem('code_verifier');
      
        const url = "https://accounts.spotify.com/api/token";
        const payload = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: clientID,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectURL,
            code_verifier: codeVerifier,
          }),
        }
      
        const body = await fetch(url, payload);
        const response = await body.json();
      
        localStorage.setItem('access_token', response.access_token);
        console.log('Logged in');
      };
    if (!localStorage.getItem('access_token')) {
        await getToken(code);
    }
}

// already logged in?

async function getEndpoint(endpoint) {
    let accessToken = localStorage.getItem('access_token');
    
    const response = await fetch(endpoint, {
        headers: {
        Authorization: 'Bearer ' + accessToken
        }
    });
    
    const data = await response.json();
    return data;
}
if (localStorage.getItem('access_token')) {
    let { id } = await getEndpoint('https://api.spotify.com/v1/me');
    console.log('Logged in as ' + id);
}
else {
    loginBtn.disabled = false;
}

/*
 * fetch playlists
 */

async function fetchPlaylists() {
    
    clog("Retrieving playlists...", 1)

    // create table
    let table = document.createElement("table");
    let tRow = table.createTHead().insertRow(0)
    tRow.insertCell().textContent = "Name";
    tRow.insertCell().textContent = "Tracks";
    tRow.insertCell().textContent = "Convert to...";
    let tBody = table.createTBody();

    // spotify limit
    let stepLimit = 50;

    // recursive function to fetch playlists
    async function fetchPaylistsRecursive(playlistOffset, playlistTotal) {
        let response = await getEndpoint(
            'https://api.spotify.com/v1/me/playlists?client_id=' + encodeURIComponent(clientID) +
            '&offset=' + encodeURIComponent(playlistOffset) +
            '&limit=' + encodeURIComponent(stepLimit)
        ); 
        clog(`Retrieved tracks ${ playlistOffset }-${ playlistOffset + stepLimit }`, 2);
        
        // populate table
        for (const playlist of response.items) {
            
            let tRow = tBody.insertRow();
            
            // name
            tRow.insertCell().textContent = playlist.name;
            
            // tracks
            tRow.insertCell().textContent = playlist.tracks.total;

            // create convert buttons
            let btn1 = document.createElement("button");
            btn1.innerHTML = "<code>.M3U</code>";
            btn1.addEventListener("click", function() {
                convertPlaylist(playlist.id, playlist.name, playlist.tracks.total, "m3u");
            });
            let btn2 = document.createElement("button");
            btn2.innerHTML = "<code>.M3U8</code>";
            btn2.addEventListener("click", function() {
                convertPlaylist(playlist.id, playlist.name, playlist.tracks.total, "m3u8");
            });

            // append convert btns
            let tCell = tRow.insertCell();
            tCell.appendChild(btn1);
            tCell.appendChild(btn2);
        }

        // append table
        playlistsSecCont.children[0].remove();
        playlistsSecCont.appendChild(table);

        if (playlistOffset + stepLimit < playlistTotal) {
            // call `fetchPaylistsRecursive(playlistOffset + stepLimit, playlistTotal)` again for the next batch
            await fetchPaylistsRecursive(playlistOffset + stepLimit, playlistTotal)
        }
    
    
    }
    // call `fetchPaylistsRecursive(tracksOffset, tracksTotal)` for the first time
    await fetchPaylistsRecursive(0, 0);
}

/*
 * convert playlist to M3U(8)
 */

async function convertPlaylist(id, playlistName, tracksTotal, type) {

    clog("Retrieving tracks...", 1)
    
    // set progressbar max
    progress.setAttribute("max", tracksTotal);

    // create M3U file
    let fileContent = "#EXTM3U\n";

    // spotify limit
    let stepLimit = 100;

    // recursive function to fetch tracks
    async function fetchTracksRecursive(tracksOffset, tracksTotal) {
        let playlist = await getEndpoint(
            'https://api.spotify.com/v1/playlists/' + encodeURIComponent(id) + '/tracks' +
            '?client_id='+ encodeURIComponent(clientID) +
            '&offset=' + encodeURIComponent(tracksOffset) +
            '&limit=' + encodeURIComponent(stepLimit)
        );

                    
        clog(`Retrieved tracks ${ tracksOffset }-${ tracksOffset + stepLimit }`, 2);

        // populate M3U file
        for (const item of playlist.items) {
            
            if (type == "m3u") {

                // 1st line
                fileContent += `#EXTINF:${Math.floor(item.track.duration_ms / 1000)},${ (function() {
                    let artists = [];
                    for (let artist of item.track.artists) {
                        artists.push(encodeURIComponent(artist.name));
                    }
                    return artists.join("; ");
                })()} - ${item.track.name}\n`;
                
                // 2nd line
                fileContent += `${ encodeURIComponent(item.track.artists[0].name) }%20-%20${ encodeURIComponent(item.track.name) }.mp3\n`;

            } else if (type == "m3u8") {

                // 1st line
                fileContent += `#EXTINF:${Math.floor(item.track.duration_ms / 1000)},${ (function() {
                    let artists = [];
                    for (let artist of item.track.artists) {
                        artists.push(artist.name);
                    }
                    return artists.join("; ");
                })()} - ${item.track.name}\n`;

                // 2nd line
                fileContent += `${ item.track.artists[0].name } - ${ item.track.name }.mp3\n`;
            }

            progress.value++;
        }

        clog(tracksOffset);
        if (tracksOffset >= tracksTotal) {

            // create file
            let file = new Blob([fileContent], {type: type});

            // prepare download
            clog("Preparing download...", 1);
            downloadBtn.disabled = false;
            downloadA.download = `${ playlistName }.${ type }`;
            downloadA.href = URL.createObjectURL(file);
            downloadBtn.innerHTML = `Download <code>${ playlistName }.${ type.toUpperCase() }</code>`
            
            // initiate download
            downloadA.click();
            clog(`Downloaded file \`${ playlistName }.${ type }\``, 2);
        } else {
            // call `fetchTracksRecursive(tracksOffset, tracksTotal)` again for the next batch
            await fetchTracksRecursive(tracksOffset + stepLimit, tracksTotal);
        }
    }

    // call `fetchTracksRecursive(tracksOffset, tracksTotal)` for the first time
    await fetchTracksRecursive(0, tracksTotal);
}

await fetchPlaylists();