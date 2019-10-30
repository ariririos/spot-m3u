/*
 * vars
 */

// API

let clientID = "86f84ad124234ce498d1afc7470f2428"; // please create your own Spotify ID when using this project (https://developer.spotify.com/dashboard)
let redirectURL = "https://lukasticky.gitlab.io/spotify-to-m3u"
let token = "";

if (location.hostname == "127.0.0.1") {
    redirectURL = "http://127.0.0.1:5500/public/";
} else if (location.hostname == "localhost") {
    redirectURL = "http://localhost:5500/public/";
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
            console.log("%c" + message, "color: hsl(240, 69%, 49%)");
            break;
        case 2:
            console.log("%c" + message, "color: hsl(147, 69%, 49%)");
            break;
        case 3:
            console.log("%c" + message, "color: hsl(0, 100%, 50%)");
            break;
        default:
            console.log(message);
            break;
    }
}

/*
 * request access token
 */

// login btn behavior
loginBtn.addEventListener("click", function() {
    clog("Logging in...", 1)
    let scopes = "playlist-read-private"

    // request access token
    window.location = `https://accounts.spotify.com/authorize?client_id=${ encodeURIComponent(clientID) }&response_type=token${
        scopes ? "&scope=" + encodeURIComponent(scopes) : ""
    }&redirect_uri=${ encodeURIComponent(redirectURL) }`;
});

/*
 * login
 */

// get token from URL
try {
    token = window.location.hash.substr(1).split("=")[1].split("&")[0];
} catch (error) {
    token = ""
}

// login
if (token) {
    
    clog("Retrieving username...", 1)

    let XHR = new XMLHttpRequest();
    XHR.open("GET", `https://api.spotify.com/v1/me?client_id=${ encodeURIComponent(clientID) }&access_token=${ encodeURIComponent(token) }`);
    XHR.onreadystatechange = function() {
        if (XHR.readyState === XMLHttpRequest.DONE) {
            if (XHR.status === 200) {
                
                // get username
                let username = JSON.parse(XHR.response).display_name;
                clog("Logged in as: " + username, 2);
                loginBtn.textContent = `Logged in as ${username}`;

                // fetch playlists
                fetchPlaylists();

            } else {
                alert("Something went wrong. Please login again")
                window.location = redirectURL;
            }
        }
    };
    XHR.send();

} else {
    loginBtn.disabled = false;
}

/*
 * fetch playlists
 */

function fetchPlaylists() {
    
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
    function fetchPaylistsRecursive(playlistOffset, playlistTotal) {

        let XHR = new XMLHttpRequest();
        XHR.open("GET", `https://api.spotify.com/v1/me/playlists?client_id=${ encodeURIComponent(clientID) }&access_token=${ encodeURIComponent(token) }&offset=${ encodeURIComponent(playlistOffset) }&limit=${ encodeURIComponent(stepLimit) }`);
        XHR.onreadystatechange = function() {
            if (XHR.readyState === XMLHttpRequest.DONE) {
                if (XHR.status === 200) {
                    
                    // get playlists
                    let response = JSON.parse(XHR.response);
                    playlistTotal = response.total;
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
                        fetchPaylistsRecursive(playlistOffset + stepLimit, playlistTotal)
                    }
    
    
                } else {
                    alert("Something went wrong. Please login again")
                    window.location = redirectURL;
                }
            }
        };
        XHR.send();
    }

    // call `fetchPaylistsRecursive(tracksOffset, tracksTotal)` for the first time
    fetchPaylistsRecursive(0, 0)
}

/*
 * convert playlist to M3U(8)
 */

function convertPlaylist(id, playlistName, tracksTotal, type) {

    clog("Retrieving tracks...", 1)
    
    // set progressbar max
    progress.setAttribute("max", tracksTotal);

    // create M3U file
    let fileContent = "#EXTM3U\n";

    // spotify limit
    let stepLimit = 100;

    // recursive function to fetch tracks
    function fetchTracksRecursive(tracksOffset, tracksTotal) {
        let XHR = new XMLHttpRequest();
        XHR.open("GET", `https://api.spotify.com/v1/playlists/${ encodeURIComponent(id) }/tracks?client_id=${ encodeURIComponent(clientID) }&access_token=${ encodeURIComponent(token) }&offset=${ encodeURIComponent(tracksOffset) }&limit=${ encodeURIComponent(stepLimit) }`);
        XHR.onreadystatechange = function() {
            if (XHR.readyState === XMLHttpRequest.DONE) {
                if (XHR.status === 200) {
                    
                    // get tracks
                    let playlist = JSON.parse(XHR.response);
                    clog(`Retrieved tracks ${ tracksOffset }-${ tracksOffset + stepLimit }`, 2);
    
                    // populate M3U file
                    for (const item of playlist.items) {
                        
                        if (type == "m3u") {
    
                            // 1st line
                            fileContent += `#EXTINF:${Math.floor(item.track.duration_ms / 1000)},${ (function() {
                                let artists = [];
                                for (artist of item.track.artists) {
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
                                for (artist of item.track.artists) {
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
                        fetchTracksRecursive(tracksOffset + stepLimit, tracksTotal)
                    }
    
                } else {
                    alert("Something went wrong. Please login again")
                    window.location = redirectURL;
                }
            }
        };
        XHR.send();
    }

    // call `fetchTracksRecursive(tracksOffset, tracksTotal)` for the first time
    fetchTracksRecursive(0, tracksTotal)
}