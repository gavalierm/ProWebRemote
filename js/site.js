// Variables

// Connection
var host = "10.1.1.33";
var port = "50000";
var pass = "control";
var stagePass = "stage";

// User Preference
var continuousPlaylist = true;
var retrieveEntireLibrary = false;
var forceSlides = false;
var followProPresenter = true;
var advancedLiveDisplay = false;
var useCookies = true;

// Application
var authenticated = false;
var stageAuthenticated = false;

var libraryList = [];
var playlistList = [];
var audioPlaylistList = [];
var libraryPresentationList = [];
var libraryPresentationNameList = [];
var playlistHeaderList = [];
var playlistPresentationList = [];
var playlistMediaList = [];
var libraryRequests = [];
var playlistRequests = [];
var audioRequests = [];
var initialPresentationLocation;
var slideCols = 3;
var wsUri = "ws://" + host + ":" + port;
var wsStageUri = "ws://" + host + ":" + port;
var resetTimeout;
var refresh = true;
var inputTyping = false;
var presentationDisplayRequest = [];
var previousPresentationRequest = false;

// End Variables


// WebSocket Functions

function connect() {
    // Show disconnected status
    $("#status").attr("class", "disconnected");
    remoteWebSocket = new WebSocket(wsUri + "/remote");
    remoteWebSocket.onopen = function(evt) { onOpen(evt) };
    remoteWebSocket.onclose = function(evt) { onClose(evt) };
    remoteWebSocket.onmessage = function(evt) { onMessage(evt) };
    remoteWebSocket.onerror = function(evt) { onError(evt) };
    // If advanced live display is enabled
    if (advancedLiveDisplay) {
        // Enable the stage display communication
        connectStage();
    }
}

function onOpen(evt) {
    if (!authenticated) {
        remoteWebSocket.send('{"action":"authenticate","protocol":"700","password":"' + pass + '"}');
    }
}

function onMessage(evt) {
    var obj = JSON.parse(evt.data);
    // console.log("Message: " + evt.data);

    if (obj.action == "authenticate" && obj.authenticated == "1" && authenticated == false) {
        // If the data is stale
        if (refresh) {
            // Get the libraries and library contents, playlists and playlist contents
            getLibrary();
            // Get the audio playlists and playlist contents
            getAudioPlaylists();
            // Get clocks
            getClocks();
            // Get messages
            getMessages();
            // Get stage layouts
            getStageLayouts();
            // Set data to fresh
            refresh = false;
        }
        // Set as authenticated
        authenticated = true;
        // Show connected status
        $("#status").attr("class", "connected");
        // Prevent disconnect auto-refresh
        clearTimeout(resetTimeout);
        // Start receiving clock times from ProPresenter
        startReceivingClockData();
    } else if (obj.action == "libraryRequest") {
        // Show downloading status
        $("#status").attr("class", "downloading-library");
        // Empty the library area
        $("#library-content").empty();
        // Empty the library list
        libraryList = [];
        // Empty the library presentation list
        libraryPresentationList = [];
        // Empty the library presentation name list
        libraryPresentationNameList = [];
        // Empty the library request list
        libraryRequests = [];
        // Create a variable to hold the libraries
        var data = "";
        // For each item in the libraries
        obj.library.forEach(function(item, index) {
            // Add the library if required
            data += createLibrary(item);
            // If set to only get names from ProPresenter libraries
            if (!retrieveEntireLibrary) {
                // Create a presentation name element for the library
                createPresentationName(item);
            } else {
                // Add this library item location to the requests array
                libraryRequests.push(item);
                // Get the presentation file from the library
                getPresentation(item);
            }
        });
        // Add the libraries to the library content area
        $("#library-content").append(data);
        // Show connected status
        $("#status").attr("class", "connected");
        // Get playlists
        getPlaylists();
    } else if (obj.action == "playlistRequestAll") {
        // Show downloading status
        $("#status").attr("class", "downloading-playlist");
        // Empty the playlist area
        $("#playlist-content").empty();
        // Empty the playlist list
        playlistList = [];
        // Empty the playlist presentation list
        playlistPresentationList = [];
        // Empty the playlist header list
        playlistHeaderList = [];
        // Empty the playlist media list
        playlistMediaList = [];
        // Empty the playlist request list
        playlistRequests = [];
        // Create a variable to hold the playlists
        var data = "";
        // For each playlist
        $(obj.playlistAll).each(
            function() {
                // Check if this object is a playlist group or playlist
                if (this.playlistType == "playlistTypeGroup") {
                    // Create a new playlist group
                    data += createPlaylistGroup(this);
                } else if (this.playlistType == "playlistTypePlaylist") {
                    // Create a new playlist
                    data += createPlaylist(this);
                }
            }
        );
        // Add the playlists to the playlist content area
        $("#playlist-content").append(data);
    } else if (obj.action == "audioRequest") {
        // Show downloading status
        $("#status").attr("class", "downloading-audio");
        // Empty the audio area
        $("#audio-content").empty();
        // Empty the audio playlist list
        var audioPlaylistList = [];
        // Empty the audio request list
        audioRequests = [];
        // Create a variable to hold the audio playlists
        var data = "";
        // For each audio playlist
        $(obj.audioPlaylist).each(
            function() {
                // Check if this object is a audio playlist group or audio playlist
                if (this.playlistType == "playlistTypeGroup") {
                    // Create a new audio playlist group
                    data += createAudioPlaylistGroup(this);
                } else if (this.playlistType == "playlistTypePlaylist") {
                    // Create a new audio playlist
                    data += createAudioPlaylist(this);
                }
            }
        );
        // Add the audio playlists to the audio playlist content area
        $("#audio-content").append(data);
        // Show connected status
        $("#status").attr("class", "connected");
        // Get the current audio status and song
        getAudioStatus();
    } else if (obj.action == "clockRequest") {
        // Empty the clock area
        $("#timer-content").empty();
        // Create a variable to hold the clocks
        var data = "";
        // For each clock in the list
        obj.clockInfo.forEach(function(item, index) {
            // Create the clock
            data += createClock(item, index);
        });
        // Add the clocks to the timer content area
        $("#timer-content").append(data);
        // Prevent input fields from conflicting with slide progression
        preventInputInterference();
    } else if (obj.action == "messsageRequest") {
        // Create
        createMessages(obj);
        // Prevent input fields from conflicting with slide progression
        preventInputInterference();
    } else if (obj.action == "stageDisplaySets") {
        // Create stage display screens
        createStageScreens(obj);
    } else if (obj.action == "presentationCurrent") {
        // Create presentation
        createPresentation(obj);
    } else if (obj.action == "presentationSlideIndex") {
        // Display the current ProPresenter presentation
        displayPresentation(obj);
    } else if (obj.action == "presentationTriggerIndex") {
        // Display the current ProPresenter presentation
        displayPresentation(obj);
        // Set clear slide to active
        $("#clear-slide").addClass("activated");
        // Set clear all to active
        $("#clear-all").addClass("activated");
    } else if (obj.action == "audioTriggered") {
        // Set the current song
        setAudioSong(obj);
    } else if (obj.action == "audioPlayPause") {
        // Set the audio status
        setAudioStatus(obj.audioPlayPause);
        // Get the current song
        getCurrentAudio();
    } else if (obj.action == "audioCurrentSong") {
        // Set the current song
        setAudioSong(obj);
    } else if (obj.action == "audioIsPlaying") {
        // Set audio status
        setAudioStatus(obj.audioIsPlaying);
    } else if (obj.action == "clockStartStop") {
        // Set clock state
        setClockState(obj);
    } else if (obj.action == "clockCurrentTimes") {
        // Set clock current times
        setClockTimes(obj);
    } else if (obj.action == "clockNameChanged") {
        // Set clock name
        setClockName(obj);
    } else if (obj.action == "clockTypeChanged") {
        // Set clock type
        setClockTypePP(obj);
    } else if (obj.action == "clockIsPMChanged") {
        // Set clock format
        setClockFormat(obj);
    } else if (obj.action == "clockDurationChanged") {
        // Set clock duration
        setClockDuration(obj);
    } else if (obj.action == "clockEndTimeChanged") {
        // Set clock end time
        setClockEndTime(obj);
    } else if (obj.action == "clockOverrunChanged") {
        // Set clock overrun
        setClockOverrun(obj);
    } else if (obj.action == "clearAll") {
        // Set clear all
        setClearAll();
    } else if (obj.action == "clearAudio") {
        // Set clear audio
        setClearAudio();
    }
}

function connectStage() {
    stageWebSocket = new WebSocket(wsUri + "/stagedisplay");
    stageWebSocket.onopen = function(evt) { onStageOpen(evt) };
    stageWebSocket.onclose = function(evt) { onStageClose(evt) };
    stageWebSocket.onmessage = function(evt) { onStageMessage(evt) };
    stageWebSocket.onerror = function(evt) { onStageError(evt) };
}

function onStageOpen(evt) {
    if (!stageAuthenticated) {
        stageWebSocket.send('{"pwd":"' + stagePass + '","ptl":610,"acn":"ath"}');
    }
}

function onError(evt) {
    authenticated = false;
    console.error('Socket encountered error: ', evt.message, 'Closing socket');
    remoteWebSocket.close();
}

function onClose(evt) {
    authenticated = false;
    // Show disconnected status
    $("#status").attr("class", "disconnected");
    // Retry connection every second
    setTimeout(function() {
        connect();
    }, 1000);

    // Refresh library after 5 minutes of disconnection
    resetTimeout = setTimeout(function() {
        refresh = true;
    }, 300000);
}

function onStageMessage(evt) {
    var obj = JSON.parse(evt.data);

    if (obj.acn == "ath" && obj.ath == true && stageAuthenticated == false) {
        // Set as authenticated
        stageAuthenticated = true;
        // Request all stage display layouts
        getStageDisplayLayouts();
    } else if (obj.acn == "asl") {
        processStageDisplayLayouts(obj);
    }
}

function onStageError(evt) {
    stageAuthenticated = false;
    console.error('StageSocket encountered error: ', evt.message, 'Closing socket');
    stageWebSocket.close();
}

function onStageClose(evt) {
    stageAuthenticated = false;
    // Retry connection every second
    setTimeout(function() {
        connectStage();
    }, 1000);
}

//  End remoteWebSocket Functions


// Cookie Functions

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function checkCookie(cname) {
    var name = getCookie(cname);
    if (name != "") {
        return true;
    } else {
        return false;
    }
}

// End Cookie Functions


// Settings Functions

function getContinuousPlaylistCookie() {
    if (checkCookie("continuousPlaylist") && useCookies) {
        continuousPlaylist = (getCookie("continuousPlaylist") == "true");
        document.getElementById("continuousPlaylist-checkbox").checked = (getCookie("continuousPlaylist") == "true");
    } else {
        document.getElementById("continuousPlaylist-checkbox").checked = continuousPlaylist;
    }
}

function setContinuousPlaylistCookie(boolean) {
    setCookie("continuousPlaylist", boolean, 90);
}

function getRetrieveEntireLibraryCookie() {
    if (checkCookie("retrieveEntireLibrary") && useCookies) {
        retrieveEntireLibrary = (getCookie("retrieveEntireLibrary") == "true");
        document.getElementById("retrieveEntireLibrary-checkbox").checked = (getCookie("retrieveEntireLibrary") == "true");
    } else {
        document.getElementById("retrieveEntireLibrary-checkbox").checked = retrieveEntireLibrary;
    }
}

function setRetrieveEntireLibraryCookie(boolean) {
    setCookie("retrieveEntireLibrary", boolean, 90);
}

function getForceSlidesCookie() {
    if (checkCookie("forceSlides") && useCookies) {
        forceSlides = (getCookie("forceSlides") == "true");
        document.getElementById("forceSlides-checkbox").checked = (getCookie("forceSlides") == "true");
    } else {
        document.getElementById("forceSlides-checkbox").checked = forceSlides;
    }
}

function setForceSlidesCookie(boolean) {
    setCookie("forceSlides", boolean, 90);
}

function getFollowProPresenterCookie() {
    if (checkCookie("followProPresenter") && useCookies) {
        followProPresenter = (getCookie("followProPresenter") == "true");
        document.getElementById("followProPresenter-checkbox").checked = (getCookie("followProPresenter") == "true");
    } else {
        document.getElementById("followProPresenter-checkbox").checked = followProPresenter;
    }
}

function setFollowProPresenterCookie(boolean) {
    setCookie("followProPresenter", boolean, 90);
}

function getUseCookiesCookie() {
    if (checkCookie("useCookies") && useCookies) {
        useCookies = (getCookie("useCookies") == "true");
        document.getElementById("useCookies-checkbox").checked = (getCookie("useCookies") == "true");
    } else {
        document.getElementById("useCookies-checkbox").checked = useCookies;
    }
}

function setUseCookiesCookie(boolean) {
    setCookie("useCookies", boolean, 90);
}

function getslideColsCookie() {
    if (checkCookie("slideCols") && useCookies) {
        slideCols = parseInt(getCookie("slideCols"));
        document.getElementById("slide-cols").value = (parseInt(document.getElementById("slide-cols").max)+1) - parseInt(getCookie("slideCols"));
    } else {
        document.getElementById("slide-cols").value = (parseInt(document.getElementById("slide-cols").max)+1) - slideCols;
    }
}

function setslideColsCookie(int) {
    setCookie("slideCols", int, 90);
}

// End Settings Functions


// Build Functions

function createLibrary(obj) {
    // Variable to hold the unique status of the library in the array
    var unique = true;
    // Variable to hold the split string of the presentation path
    var pathSplit = obj.split("/");
    // Variable to hold the name of the library, retrieved from the presentation path
    var libraryName = "";
    // Variable to hold the data of the library
    var libraryData = "";
    // Iterate through each item in the split path to retrieve the library name
    pathSplit.forEach(function(item, index) {
        if (item == "Libraries") {
            libraryName = pathSplit[index + 1];
        }
    });
    // Check if the library is unique and can be added in the array
    libraryList.forEach(function(item) {
        if (item == libraryName) {
            unique = false;
        }
    });
    // If the library is unique
    if (unique) {
        // Add the library name to the library list
        libraryList.push(libraryName);
        // Create the library data
        var libraryData = '<a onclick="displayLibrary(this);"><div class="item lib library"><img src="img/library.png" /><div class="name">' + libraryName + '</div></div></a>';
    }
    return libraryData;
}

function createPlaylistGroup(obj) {
    var groupData = "";
    groupData += '<div class="playlist-group">' +
        '<a onclick="togglePlaylistVisibility(this)" class="expander collapsed"><i class="collapser fas fa-caret-right"></i><div class="item lib group"><img src="img/playlistgroup.png" />' + obj.playlistName + '</div></a>';
    $(obj.playlist).each(
        function() {
            if (this.playlistType == "playlistTypeGroup") {
                groupData += createPlaylistGroup(this);
            } else if (this.playlistType == "playlistTypePlaylist") {
                groupData += createPlaylist(this);
            }
        }
    );
    groupData += '</div>';
    return groupData;
}

function createPlaylist(obj) {
    var playlistData = '<a class="display-playlist" onclick="displayPlaylist(this);"><div class="item lib playlist presentation"><img src="img/playlist.png"/><div class="name">' + obj.playlistName + '</div></div></a>';
    playlistList.push(obj);
    obj.playlist.forEach(
        function(item, index) {
            if (item.playlistItemType == "playlistItemTypeHeader") {
                var playlistHeader = { presentationPath: item.playlistItemLocation, presentation: { presentationName: item.playlistItemName } }
                playlistHeaderList.push(playlistHeader);
            } else if (item.playlistItemType == "playlistItemTypeVideo") {
                var playlistVideo = { presentationPath: item.playlistItemLocation, presentation: { presentationName: item.playlistItemName } }
                playlistMediaList.push(playlistVideo);
            } else {
                // Add this playlist item location to the requests array
                playlistRequests.push(item.playlistItemLocation);
                // Get the presentation in the playlist from ProPresenter
                getPresentation(item.playlistItemLocation);
            }
        }
    );
    return playlistData;
}

function createAudioPlaylistGroup(obj) {
    var groupData = "";
    groupData += '<div class="playlist-group">' +
        '<a onclick="togglePlaylistVisibility(this)" class="expander collapsed"><i class="collapser fas fa-caret-right"></i><div class="item lib group"><img src="img/playlistgroup.png" />' + obj.playlistName + '</div></a>';
    $(obj.playlist).each(
        function() {
            if (this.playlistType == "playlistTypeGroup") {
                groupData += createAudioPlaylistGroup(this);
            } else if (this.playlistType == "playlistTypePlaylist") {
                groupData += createAudioPlaylist(this);
            }
        }
    );
    groupData += '</div>';
    return groupData;
}

function createAudioPlaylist(obj) {
    var playlistData = '<a class="display-playlist" onclick="displayAudioPlaylist(this);"><div class="item lib playlist audio"><img src="img/audio.png"/><div class="name">' + obj.playlistName + '</div></div></a>';
    audioPlaylistList.push(obj);
    return playlistData;
}

function createClock(obj, clockIndex) {
    var clockdata = "";
    clockData = '<div id="clock-' + clockIndex + '" class="timer-container type-' + obj.clockType + '">' +
        '<div class="timer-expand"><a onclick="toggleClockVisibility(this)" class="expander expanded"><i class="collapser fas fa-caret-down"></i></a></div>' +
        '<div class="timer-name"><input id="clock-' + clockIndex + '-name" onchange="updateClock(' + clockIndex + ');" type="text" class="text-input collapse-hide" value="' + obj.clockName + '"/><div id="clock-' + clockIndex + '-name-text" class="timer-name-text collapse-show"></div></div>' +
        '<div id="clock-' + clockIndex + '-type" class="timer-type collapse-hide">' + createClockTypeOptions(obj.clockType, clockIndex) + '</div>' +
        '<div class="timer-timeOptions collapse-hide type-0"><div><div class="element-title">Duration</div><input id="clock-' + clockIndex + '-duration" onchange="updateClock(' + clockIndex + ');" type="text" class="text-input" value="' + getClockSmallFormat(obj.clockDuration) + '"/></div><div></div></div>' +
        '<div class="timer-timeOptions collapse-hide type-1"><div><div class="element-title">Time</div><input id="clock-' + clockIndex + '-time" onchange="updateClock(' + clockIndex + ');" type="text" class="text-input" value="' + getClockSmallFormat(obj.clockEndTime) + '"/></div><div><div class="element-title">Format</div><select id="clock-' + clockIndex + '-format" onchange="updateClock(' + clockIndex + ');" class="text-input">' + createClockFormatOptions(obj.clockFormat.clockTimePeriodFormat) + '</select></div></div>' +
        '<div class="timer-timeOptions collapse-hide type-2"><div><div class="element-title">Start</div><input id="clock-' + clockIndex + '-start" onchange="updateClock(' + clockIndex + ');" type="text" class="text-input" value="' + getClockSmallFormat(obj.clockDuration) + '"/></div><div><div class="element-title">End</div><input id="clock-' + clockIndex + '-end" onchange="updateClock(' + clockIndex + ');" type="text" class="text-input" placeholder="No Limit" value="' + getClockEndTimeFormat(obj.clockEndTime) + '"/></div></div>' +
        '<div class="timer-overrun collapse-hide"><div class="element-title">Overrun</div><input id="clock-' + clockIndex + '-overrun" onchange="updateClock(' + clockIndex + ');" type="checkbox" class="checkbox text-input" ' + getClockOverrun(obj.clockOverrun) + '/></div>' +
        '<div class="timer-reset"><a onclick="resetClock(' + clockIndex + ');"><div class="option-button"><img src="img/reset.png" /></div></a></div>' +
        '<div id="clock-' + clockIndex + '-currentTime" class="timer-currentTime">' + getClockSmallFormat(obj.clockTime) + '</div>' +
        '<div class="timer-state"><a onclick="toggleClockState(' + clockIndex + ');"><div id="clock-' + clockIndex + '-state" class="option-button">Start</div></a></div></div>';

    // If the clock is active
    if (obj.clockState == true) {
        // Start receiving clock times from ProPresenter
        startReceivingClockData();
    }

    return clockData;
}

function createClockTypeOptions(clockType, clockIndex) {
    var clockTypeData = "";
    switch (clockType) {
        case 0:
            clockTypeData += '<a id="' + clockType + '" onclick="expandTypeList(this);"><div class="type-selected type-0"><img class="selected-img type-0" src="img/timer-countdown.png"><img class="selected-img type-1" src="img/timer-counttotime.png"><img class="selected-img type-2" src="img/timer-elapsedtime.png"><div class="selected-indicator"><i class="fas fa-angle-up"></i><i class="fas fa-angle-down"></i></div></div></a>' +
                '<div class="type-dropdown">' +
                '<a onclick="setClockType(this);"><div id="type-0" class="dropdown-row selected"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-countdown.png"><div class="row-name">Countdown</div></div></a>' +
                '<a onclick="setClockType(this);"><div id="type-1" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-counttotime.png"><div class="row-name">Countdown to Time</div></div></a>' +
                '<a onclick="setClockType(this);"><div id="type-2" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-elapsedtime.png"><div class="row-name">Elapsed Time</div></div></a>' +
                '</div>';
            break;
        case 1:
            clockTypeData += '<a id="' + clockType + '" onclick="expandTypeList(this);"><div class="type-selected type-1"><img class="selected-img type-0" src="img/timer-countdown.png"><img class="selected-img type-1" src="img/timer-counttotime.png"><img class="selected-img type-2" src="img/timer-elapsedtime.png"><div class="selected-indicator"><i class="fas fa-angle-up"></i><i class="fas fa-angle-down"></i></div></div></a>' +
                '<div class="type-dropdown">' +
                '<a onclick="setClockType(this);"><div id="type-0" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-countdown.png"><div class="row-name">Countdown</div></div></a>' +
                '<a onclick="setClockType(this);"><div id="type-1" class="dropdown-row selected"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-counttotime.png"><div class="row-name">Countdown to Time</div></div></a>' +
                '<a onclick="setClockType(this);"><div id="type-2" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-elapsedtime.png"><div class="row-name">Elapsed Time</div></div></a>' +
                '</div>';
            break;
        default:
            clockTypeData += '<a id="' + clockType + '" onclick="expandTypeList(this);"><div class="type-selected type-2"><img class="selected-img type-0" src="img/timer-countdown.png"><img class="selected-img type-1" src="img/timer-counttotime.png"><img class="selected-img type-2" src="img/timer-elapsedtime.png"><div class="selected-indicator"><i class="fas fa-angle-up"></i><i class="fas fa-angle-down"></i></div></div></a>' +
                '<div class="type-dropdown">' +
                '<a onclick="setClockType(this);"><div id="type-0" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-countdown.png"><div class="row-name">Countdown</div></div></a>' +
                '<a onclick="setClockType(this);"><div id="type-1" class="dropdown-row"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-counttotime.png"><div class="row-name">Countdown to Time</div></div></a>' +
                '<a onclick="setClockType(this);"><div id="type-2" class="dropdown-row selected"><div class="row-indicator"><i class="fas fa-check"></i></div><img class="row-img" src="img/timer-elapsedtime.png"><div class="row-name">Elapsed Time</div></div></a>' +
                '</div>';
            break;
    }
    return clockTypeData;
}

function createClockFormatOptions(formatType) {
    switch (formatType) {
        case 0:
            return '<option value="0" selected>AM</option><option value="1">PM</option><option value="2">24Hr</option>';
        case 1:
            return '<option value="0">AM</option><option value="1" selected>PM</option><option value="2">24Hr</option>';
        default:
            return '<option value="0">AM</option><option value="1">PM</option><option value="2" selected>24Hr</option>';
    }
}

function createMessages(obj) {
    obj.messages.forEach(
        function(item) {

        }
    );

}

function createStageScreens(obj) {
    var screenData = "";
    obj.stageScreens.forEach(
        function(item) {
            var selectedLayout = item.stageLayoutSelectedLayoutUUID;
            screenData += '<div class="stage-screen"><div class="screen-name">' + item.stageScreenName + '</div><div class="stage-layout"><select onchange="setStageLayout(this)" name="stage-layout" id="' + item.stageScreenUUID + '">';
            obj.stageLayouts.forEach(
                function(item) {
                    if (item.stageLayoutUUID == selectedLayout) {
                        screenData += '<option value="' + item.stageLayoutUUID + '" selected>' + item.stageLayoutName + '</option>';
                    } else {
                        screenData += '<option value="' + item.stageLayoutUUID + '">' + item.stageLayoutName + '</option>';
                    }
                }
            );
            screenData += '</select></div></div>';
        }
    );
    // Add the screen data to stage screens
    document.getElementById("stage-screens").innerHTML = screenData;
}

function createPresentationName(obj) {
    // Variable to hold the unique status of the presentation
    var unique = true;
    // Variable to hold the split string of the presentation path
    var pathSplit = obj.split("/");
    // Variable to hold the name of the presentation, retrieved from the presentation path
    var presentationName = "";
    // Iterate through each item in the split path to retrieve the library name
    pathSplit.forEach(function(item, index) {
        if (item == "Libraries") {
            presentationName = pathSplit[index + 2].replace(".pro", "");
        }
    });
    // Check if the presentation is unique and can be added in the array
    libraryPresentationNameList.forEach(function(item) {
        if (item.presentationName == presentationName) {
            unique = false;
        }
    });
    // If the presentation is unique
    if (unique) {
        // Create object with presentation name and path
        var presentationObj = { presentationName: presentationName, presentationPath: obj }
            // Add the new presentation object to the library presentation name list
        libraryPresentationNameList.push(presentationObj);
    }
}

// End Build Functions


// Presentation Build Functions

function createPresentation(obj) {
    // Variable to hold the correct index
    var count = 0;
    // Variable to hold the unique status of the presentation
    var unique = true;
    // Set the correct index for grouped slides
    $(obj.presentation.presentationSlideGroups).each(
        function() {
            $(this.groupSlides).each(
                function() {
                    // Set the current count as the slide index
                    this.slideIndex = count;
                    count++;
                }
            );
        }
    );
    // Add this presentation to either the playlist or library presentation list
    if (obj.presentationPath.charAt(0) == '0') {
        if (playlistRequests.includes(obj.presentationPath)) {
            // Check if the presentation is unique and can be added in the array
            $(playlistPresentationList).each(
                function() {
                    if (this.presentationPath == obj.presentationPath) {
                        unique = false;
                    }
                }
            );
            if (unique) {
                playlistPresentationList.push(obj);
                // Remove the request from the array
                removeArrayValue(playlistRequests, obj.presentationPath);
            }
            if (playlistRequests.length == 0) {
                // Get the current displayed presentation from ProPresenter
                getCurrentPresentation();
                // Show connected status
                $("#status").attr("class", "connected");
            }
        } else {
            // Set the initial presentation location
            initialPresentationLocation = obj.presentationPath;
            // Get the current slide index
            getCurrentSlide();
        }
    } else {
        if (libraryRequests.includes(obj.presentationPath)) {
            // Check if the presentation is unique and can be added in the array
            $(libraryPresentationList).each(
                function() {
                    if (this.presentationPath == obj.presentationPath) {
                        unique = false;
                    }
                }
            );
            if (unique) {
                libraryPresentationList.push(obj);
                // Remove the request from the array
                removeArrayValue(libraryRequests, obj.presentationPath);
            }
        } else {
            // Set the initial presentation location
            initialPresentationLocation = obj.presentationPath;
            // Get the current slide index
            getCurrentSlide();
        }
    }
    // If set to only get names from ProPresenter libraries
    if (!retrieveEntireLibrary) {
        // Display this presentation if requested
        if (presentationDisplayRequest[0] == obj.presentationPath) {
            // Create an object to hold the presentation data
            var presentationObject = { action: "presentationTriggerIndex", presentationPath: presentationDisplayRequest[0], slideIndex: presentationDisplayRequest[1] };
            // Display the presentation
            displayPresentation(presentationObject);
            // Set the presentation display request to empty
            presentationDisplayRequest = [];
            // Show connected status
            $("#status").attr("class", "connected");
        }
    }
}

// End Presentation Build Functions


// Clear Functions

function clearAll() {
    remoteWebSocket.send('{"action":"clearAll"}');
    setClearAll();
}

function setClearAll() {
    $('#live').empty();
    $(".presentation-content").children(".selected").removeClass("selected");
    $("#clear-all").removeClass("activated");
    $("#clear-slide").removeClass("activated");
    $("#clear-media").removeClass("activated");
    $("#clear-audio").removeClass("activated");
    $("#clear-props").removeClass("activated");
    $(".current").empty();
    $("#audio-status").addClass("disabled");
    $("#audio-items").children("a").children("div").removeClass("highlighted");
}

function clearAudio() {
    remoteWebSocket.send('{"action":"clearAudio"}');
    setClearAudio();
}

function setClearAudio() {
    $("#clear-audio").removeClass("activated");
    $(".playing-audio").empty();
    $("#audio-status").addClass("disabled");
    $("#audio-items").children("a").children("div").removeClass("highlighted");
    if ($(".icons a.activated").length < 2) {
        $("#clear-all").removeClass("activated");
    }
}

function clearMessages() {
    remoteWebSocket.send('{"action":"clearMessages"}');
    $("#clear-messages").removeClass("activated");
    if ($(".icons a.activated").length < 2) {
        $("#clear-all").removeClass("activated");
    }
}

function clearProps() {
    remoteWebSocket.send('{"action":"clearProps"}');
    $("#clear-props").removeClass("activated");
    if ($(".icons a.activated").length < 2) {
        $("#clear-all").removeClass("activated");
    }
}

function clearAnnouncements() {
    remoteWebSocket.send('{"action":"clearAnnouncements"}');
    $("#clear-announcements").removeClass("activated");
    if ($(".icons a.activated").length < 2) {
        $("#clear-all").removeClass("activated");
    }
}

function clearSlide() {
    $('#live').empty();
    remoteWebSocket.send('{"action":"clearText"}');
    $("#clear-slide").removeClass("activated");
    if ($(".icons a.activated").length < 2) {
        $("#clear-all").removeClass("activated");
    }
}

function clearMedia() {
    remoteWebSocket.send('{"action":"clearVideo"}');
    $("#clear-media").removeClass("activated");
    $(".playing-timeline").empty();
    if ($(".icons a.activated").length < 2) {
        $("#clear-all").removeClass("activated");
    }
}

// End Clear Functions


// Set Data Functions

function setCurrentSlide(index, location) {
    // Iterate over each slide number
    $(".slide-number").each(
        function() {
            // If this slide number and location match the requested slide
            if ($(this).text() == index && $(this).parent().parent().parent().attr("id") == location) {
                // Set the slide as selected
                $(this).parent().parent().parent().parent().addClass("selected");
                // If the slide is not currently visible
                if (!isElementInViewport(document.getElementById("slide" + index + "." + location))) {
                    // Scroll to place the slide in view
                    document.getElementById("slide" + index + "." + location).scrollIntoView();
                    // Get the presentation container
                    var presentationContainer = document.getElementById("presentations");
                    // If the presentation container is not scrolled all the way to the bottom
                    if (presentationContainer.scrollTop + presentationContainer.clientHeight < presentationContainer.scrollHeight) {
                        // Scroll the container down by 10 pixels to avoid cutting off slide
                        document.getElementById("presentations").scrollTop = document.getElementById("presentations").scrollTop - 10;
                    }
                }
            }
        }
    );
    // Check if this is a playlist or library presentation
    if (location.charAt(0) == '0') {
        // Set the current live slide image
        $(playlistPresentationList).each(
            function() {
                if (this.presentationPath == location) {
                    $(this.presentation.presentationSlideGroups).each(
                        function() {
                            $(this.groupSlides).each(
                                function() {
                                    if (this.slideIndex == index - 1) {
                                        var image = new Image();
                                        image.src = 'data:image/png;base64,' + this.slideImage;
                                        $('#live').empty();
                                        $('#live').append(image);
                                    }
                                }
                            );
                        }
                    );
                }
            }
        );
    } else {
        // Set the current live slide image
        $(libraryPresentationList).each(
            function() {
                if (this.presentationPath == location) {
                    $(this.presentation.presentationSlideGroups).each(
                        function() {
                            $(this.groupSlides).each(
                                function() {
                                    if (this.slideIndex == index - 1) {
                                        var image = new Image();
                                        image.src = 'data:image/png;base64,' + this.slideImage;
                                        $('#live').empty();
                                        $('#live').append(image);
                                    }
                                }
                            );
                        }
                    );
                }
            }
        );
    }
}

// End Set Data Functions


// Get Data Functions

function getCurrentPresentation() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"presentationCurrent", "presentationSlideQuality": 25}');
}

function getCurrentSlide() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"presentationSlideIndex"}');
}

function getCurrentAudio() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"audioCurrentSong"}');
}

function getAudioStatus() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"audioIsPlaying"}');
}

function getClocks() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"clockRequest"}');
}

function getMessages() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"messageRequest"}');
}

function getStageLayouts() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"stageDisplaySets"}');
}

function getPresentation(location) {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action": "presentationRequest","presentationPath": "' + location + '"}');
}

function getLibrary() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"libraryRequest"}');
    // Empty the library presentation list
    libraryPresentationList = [];
    // Empty the library items area
    $("#library-items").empty();
    // Empty the left count
    $("#left-count").empty();
    // Empty the presentations area
    $("#presentations").empty();
}

function getPlaylists() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"playlistRequestAll"}');
    // Empty the playlist presentation list
    playlistPresentationList = [];
    // Empty the playlist list
    playlistList = [];
    // Empty the playlist items area
    $("#playlist-items").empty();
}

function getAudioPlaylists() {
    // Send the request to ProPresenter
    remoteWebSocket.send('{"action":"audioRequest"}');
    // Empty the audio playlist list
    audioPlaylistList = [];
    // Empty the audio items area
    $("#audio-items").empty();
    // Empty the right count
    $("#right-count").empty();
}

// End Get Data Functions


// Toggle Data Functions

function toggleRetrieveEntireLibrary(obj) {
    if (useCookies) {
        setRetrieveEntireLibraryCookie(obj.checked);
        retrieveEntireLibrary = obj.checked;
    }
}

function toggleContinuousPlaylist(obj) {
    if (useCookies) {
        setContinuousPlaylistCookie(obj.checked);
        continuousPlaylist = obj.checked;
    }
}

function toggleForceSlides(obj) {
    if (useCookies) {
        setForceSlidesCookie(obj.checked);
        forceSlides = obj.checked;
    }
}

function toggleFollowProPresenter(obj) {
    if (useCookies) {
        setFollowProPresenterCookie(obj.checked);
        followProPresenter = obj.checked;
    }
}

function toggleUseCookies(obj) {
    setUseCookiesCookie(obj.checked);
    useCookies = obj.checked;
}

function toggleAudioPlayPause() {
    remoteWebSocket.send('{"action":"audioPlayPause"}');
}

function toggleTimelinePlayPause() {
    remoteWebSocket.send('{"action":"timelinePlayPause","presentationPath":""}');
}

function togglePlaylistVisibility(obj) {
    if ($(obj).hasClass("collapsed")) {
        $(obj).removeClass("collapsed")
        $(obj).children("i").removeClass("fa-caret-right");
        $(obj).children("i").addClass("fa-caret-down");
    } else {
        $(obj).addClass("collapsed")
        $(obj).children("i").removeClass("fa-caret-down");
        $(obj).children("i").addClass("fa-caret-right");
    }
}

function toggleClockVisibility(obj) {
    if ($(obj).hasClass("expanded")) {
        var index = $(obj).parent().parent().attr("id");
        $("#" + index + "-name-text").text($("#" + index + "-name").val());
        $(obj).parent().parent().addClass("collapse");
        $(obj).removeClass("expanded")
        $(obj).children("i").removeClass("fa-caret-down");
        $(obj).children("i").addClass("fa-caret-right");
    } else {
        $(obj).parent().parent().removeClass("collapse");
        $(obj).addClass("expanded")
        $(obj).children("i").removeClass("fa-caret-right");
        $(obj).children("i").addClass("fa-caret-down");
    }
}

function toggleClockState(int) {
    // If the clock is not started
    if ($("#clock-" + int + "-state").text() == "Start") {
        // Start receiving clock times from ProPresenter
        startReceivingClockData();
        // Start the clock
        remoteWebSocket.send('{"action":"clockStart","clockIndex":"' + int + '"}');
    } else {
        // Stop the clock
        remoteWebSocket.send('{"action":"clockStop","clockIndex":"' + int + '"}');
    }
}

function expandTypeList(obj) {
    // Show the dropdown
    $(obj).parent("div").children(".type-dropdown").show();
    // Create a element click handler to allow the opening of the custom dropdown
    window.addEventListener('click', function(e) {
        // If the clicked element is contained within the dropdown
        if (document.getElementById(obj.parentNode.id).contains(e.target)) {} else {
            // Hide the dropdown
            $(obj).parent("div").children(".type-dropdown").hide();
        }
    });
}

// End Toggle Data Functions


// Update Clock Functions

function updateClock(clockIndex) {
    // Get the clock name
    var clockName = document.getElementById("clock-" + clockIndex + "-name").value;
    // Get the clock type
    var clockType = document.getElementById("clock-" + clockIndex + "-type").firstElementChild.id;
    // Get the clock overrun setting
    var clockOverrun = document.getElementById("clock-" + clockIndex + "-overrun").checked;
    // Send the request according to the clock type
    if (clockType == 0) {
        // Get the clock duration / start time / count to time
        var clockDuration = document.getElementById("clock-" + clockIndex + "-duration").value;
        // Send the change to ProPresenter
        remoteWebSocket.send('{"action":"clockUpdate","clockIndex":"' + clockIndex + '","clockType":"0","clockName":"' + clockName + '","clockTime":"' + clockDuration + '","clockOverrun":"' + clockOverrun + '"}');
    } else if (clockType == 1) {
        // Get the clock count to time
        var clockTime = document.getElementById("clock-" + clockIndex + "-time").value;
        // Get the clock format
        var clockFormat = document.getElementById("clock-" + clockIndex + "-format").value;
        // Send the change to ProPresenter
        remoteWebSocket.send('{"action":"clockUpdate","clockIndex":"' + clockIndex + '","clockType":"1","clockName":"' + clockName + '","clockElapsedTime":"' + clockTime + '","clockOverrun":"' + clockOverrun + '","clockTimePeriodFormat":"' + clockFormat + '"}');
    } else {
        // Get the clock start time
        var clockStart = document.getElementById("clock-" + clockIndex + "-start").value;
        // Get the clock end time
        var clockEndTime = getClockEndTimeFormat(document.getElementById("clock-" + clockIndex + "-end").value);
        // Send the change to ProPresenter
        remoteWebSocket.send('{"action":"clockUpdate","clockIndex":"' + clockIndex + '","clockType":"2","clockName":"' + clockName + '","clockTime":"' + clockStart + '","clockOverrun":"' + clockOverrun + '","clockElapsedTime":"' + clockEndTime + '"}');
    }
}

// End Update Clock Functions


// Page Actions Functions

function focusTimelineControls() {
    $("#audio-controls").hide();
    $("#timeline-controls").show();
    $("#control-slide").attr("src", "img/slideblue.png");
    $("#control-audio").attr("src", "img/clearaudio.png");
}

function focusAudioControls() {
    $("#timeline-controls").hide();
    $("#audio-controls").show();
    $("#control-audio").attr("src", "img/audioblue.png");
    $("#control-slide").attr("src", "img/clearslide.png");
}

function setAudioStatus(obj) {
    if (obj == "Playing") {
        $("#audio-status").removeClass("fa-play").removeClass("disabled");
        $("#audio-status").addClass("fa-pause");
        $("#clear-audio").addClass("activated");
        $("#clear-all").addClass("activated");
    } else if (obj == "Pause") {
        $("#audio-status").removeClass("fa-pause").removeClass("disabled");
        $("#audio-status").addClass("fa-play");
        $("#clear-audio").addClass("activated");
        $("#clear-all").addClass("activated");
        getAudioStatus();
    } else if (obj) {
        getCurrentAudio();
        $("#audio-status").removeClass("disabled");
        $("#clear-audio").addClass("activated");
        $("#clear-all").addClass("activated");
    } else {
        $("#clear-audio").removeClass("activated");
        $(".playing-audio").empty();
        $("#audio-status").addClass("disabled");
        $("#audio-items").children("a").children("div").removeClass("highlighted");
        if ($(".icons div.activated").length < 1) {
            $("#clear-all").removeClass("activated");
        }
    }

}

function setAudioSong(obj) {
    // Create variable to hold if audio
    var isAudio = false;
    // Iterate through each audio playlist
    audioPlaylistList.forEach(
        function(item) {
            // Iterate through each audio item
            item.playlist.forEach(
                function(item) {
                    // If the audio item name matches the current playing item
                    if (item.playlistItemName == obj.audioName) {
                        // Set the current playing item as audio
                        isAudio = true;
                    }
                }
            );
        }
    );

    // If this is an audio file
    if (isAudio) {
        // Set the playing audio title
        $(".playing-audio").text(obj.audioName);
    } else {
        // Set the playing timeline title
        $(".playing-timeline").text(obj.audioName);
    }
}

function clearStageMessage() {
    document.getElementById("stage-message").value = "";
    remoteWebSocket.send('{"action":"stageDisplayHideMessage"}');
}

function hideStageMessage() {
    remoteWebSocket.send('{"action":"stageDisplayHideMessage"}');
}

function showStageMessage() {
    var message = document.getElementById("stage-message").value;
    remoteWebSocket.send('{"action":"stageDisplaySendMessage","stageDisplayMessage":"' + message + '"}');
}

function setStageLayout(obj) {
    // Send the change stage layout request to ProPresenter
    remoteWebSocket.send('{"action":"stageDisplayChangeLayout","stageLayoutUUID":"' + $(obj).val() + '","stageScreenUUID":"' + $(obj).attr("id") + '"}');
}

function stopAllClocks() {
    // Stop receiving clock times from ProPresenter
    stopReceivingClockData();
    // Send the stop all clocks command
    remoteWebSocket.send('{"action":"clockStopAll"}');
}

function resetAllClocks() {
    // Start receiving clock times from ProPresenter
    startReceivingClockData();
    // Send the reset all clocks command
    remoteWebSocket.send('{"action":"clockResetAll"}');
}

function startAllClocks() {
    // Start receiving clock times from ProPresenter
    startReceivingClockData();
    // Send the start all clocks command
    remoteWebSocket.send('{"action":"clockStartAll"}');
}

function startReceivingClockData() {
    // Send the start receiving clock times command
    remoteWebSocket.send('{"action":"clockStartSendingCurrentTime"}');
}

function stopReceivingClockData() {
    // Send the stop receiving clock times command
    remoteWebSocket.send('{"action":"clockStopSendingCurrentTime"}');
}

function resetClock(index, type) {
    // Start receiving clock times from ProPresenter
    startReceivingClockData();
    // Send the reset clock command
    remoteWebSocket.send('{"action":"clockReset","clockIndex":"' + index + '"}');
}


function setClockName(obj) {
    // Set the clock name in the input
    document.getElementById("clock-" + obj.clockIndex + "-name").value = obj.clockName;
    // Set the clock name in the div
    document.getElementById("clock-" + obj.clockIndex + "-name-text").innerHTML = obj.clockName;
}

function setClockType(obj) {
    // Array of supported clock types
    var types = ["type-0", "type-1", "type-2"];
    // Get the clock type
    var type = $(obj).children("div").attr("id");
    // Get the clock index
    var clockIndex = $(obj).parent().parent().attr("id").split("-")[1];
    // Remove the selected class from all rows of the current dropdown
    $(obj).parent().children("a").children(".dropdown-row").removeClass("selected");
    // Set the current element as selected
    $(obj).children("div").addClass("selected");
    // Set the parent div ID to the type
    $(obj).parent().parent().children("a").attr("id", type.split("-")[1]);
    // Show options specific to the clock type
    $(obj).parent().parent().parent().removeClass(types).addClass(type);
    // Hide all open dropdowns
    $(".type-dropdown").hide();
    // Send the updated type to ProPresenter
    updateClock(clockIndex);
}

function setClockTypePP(obj) {
    // Array of supported clock types
    var types = ["type-0", "type-1", "type-2"];
    // Remove all clock types
    $("#clock-" + obj.clockIndex).removeClass(types);
    // Add the clock type
    $("#clock-" + obj.clockIndex).addClass("type-" + obj.clockType);
}

function setClockFormat(obj) {
    document.getElementById("clock-" + obj.clockIndex + "-format").value = obj.clockFormat.clockTimePeriodFormat;
}

function setClockDuration(obj) {
    document.getElementById("clock-" + obj.clockIndex + "-duration").value = getClockSmallFormat(obj.clockDuration);
    document.getElementById("clock-" + obj.clockIndex + "-start").value = getClockSmallFormat(obj.clockDuration);
}

function setClockEndTime(obj) {
    document.getElementById("clock-" + obj.clockIndex + "-time").value = getClockSmallFormat(obj.clockEndTime);
    document.getElementById("clock-" + obj.clockIndex + "-end").value = getClockEndTimeFormat(obj.clockEndTime);
}

function setClockOverrun(obj) {
    document.getElementById("clock-" + obj.clockIndex + "-overrun").checked = obj.clockOverrun;
}

function setClockTimes(obj) {
    obj.clockTimes.forEach(
        function(item, index) {
            document.getElementById("clock-" + index + "-currentTime").innerHTML = getClockSmallFormat(item);
        }
    );
}

function setClockState(obj) {
    document.getElementById("clock-" + obj.clockIndex + "-currentTime").innerHTML = getClockSmallFormat(obj.clockTime);
    if (obj.clockState == true) {
        document.getElementById("clock-" + obj.clockIndex + "-state").innerHTML = "Stop";
    } else {
        document.getElementById("clock-" + obj.clockIndex + "-state").innerHTML = "Start";
    }
}

function triggerSlide(obj) {
    // Get the slide location
    var location = ($(obj).attr("id"));
    // Get the slide index
    var index = $(obj).children("div").children("div").children(".slide-number").text() - 1;
    // Check if this is a playlist or library presentation
    if (location.charAt(0) == '0') {
        // Sent the request to ProPresenter
        remoteWebSocket.send('{"action":"presentationTriggerIndex","slideIndex":"' + index + '","presentationPath":"' + location + '"}');
        // Check if we should follow ProPresenter
        if (followProPresenter) {
            // Remove selected from all playlist items
            $("#playlist-items").children("a").children("div").removeClass("selected");
            // Remove highlighted from all playlist items
            $("#playlist-items").children("a").children("div").removeClass("highlighted");
        }
    } else {
        // Sent the request to ProPresenter
        remoteWebSocket.send('{"action":"presentationTriggerIndex","slideIndex":"' + index + '","presentationPath":"' + location.replace(/\//g, "\\/") + '"}');
        // Check if we should follow ProPresenter
        if (followProPresenter) {
            // Remove selected from all library items
            $("#library-items").children("a").children("div").removeClass("selected");
            // Remove highlighted from all library items
            $("#library-items").children("a").children("div").removeClass("highlighted");
        }
    }

    // Check if we should follow ProPresenter
    if (followProPresenter) {
        // Iterate through each item in the library / playlist area
        $(".item.con").each(
            function() {
                // If the current item matches the slide presentation location
                if ($(this).attr("id") == location) {
                    // Highlight the current item
                    $(this).addClass("highlighted");
                }
            }
        );
    }


    // Check if this is a media item
    if ($(obj).children("div").hasClass("media")) {
        // Remove selected from any previous slides
        $(".slide-container").removeClass("selected");
        // Remove active from any previous media
        $(".media").removeClass("active");
        // Set clear slide to inactive
        $("#clear-slide").removeClass("activated");
        // Set clear media to active
        $("#clear-media").addClass("activated");
        // Empty the live preview area
        $('#live').empty();
        // Set the media element as active
        $(obj).children("div").addClass("active");
    }

    // Set clear all to active
    $("#clear-all").addClass("activated");
}

// Force Previous Slide
function triggerPreviousSlide() {
    // Get the current slide
    var currentSlide = $(".slide-container.selected");
    // Get the current media
    var currentMedia = $(".media.active");
    // Check if the currently selected item is a presentation or media item
    if (currentSlide.length > 0) {
        // Get the current location
        var currentLocation = $(".slide-container.selected").children("a").attr("id");
        // Get the current slide number
        var currentSlideNumber = parseInt($(currentSlide).find(".slide-number").text());
        // Create variable to determine loop status
        var loop = true;
        // Loop until a slide is found or the slides are exhausted
        while (loop) {
            // If the current slide is at least the first
            if (currentSlideNumber > 1) {
                // Decrease the slide number
                currentSlideNumber--;
                // Create the next slide id
                var nextSlideId = "slide" + currentSlideNumber + "." + currentLocation;
                // If the next slide is not disabled
                if (!$(document.getElementById(nextSlideId)).hasClass("disabled")) {
                    // Trigger the next slide
                    triggerSlide($(document.getElementById(nextSlideId)).children("a"));
                    // Stop the loop
                    loop = false;
                }
            } else {
                // Get the current presentation
                var currentPresentation = $(".slide-container.selected").parent("div").parent("div");
                // Get the current presentation location
                var currentPresentationLocation = $(currentPresentation).attr("id");
                // Get the current presentation number
                var currentPresentationNumber = parseInt(currentPresentationLocation.split(":")[1]);
                // Create variable to determine loop status
                var presentationLoop = true;
                // Loop until a presentation is found or the presentations are exhausted
                while (presentationLoop) {
                    // If the current presentation is at least the first
                    if (currentPresentationNumber > 1) {
                        // Decrease the presentation number
                        currentPresentationNumber--;
                        // Create the next presentation id
                        var nextPresentationId = currentPresentationLocation.split(":")[0] + ":" + currentPresentationNumber;
                        // Get the next presentation
                        var nextPresentation = document.getElementById(nextPresentationId);
                        // If the next presentation exists
                        if (nextPresentation != null) {
                            // Trigger the first available slide of the next presentation
                            triggerSlide($(nextPresentation).children(".presentation-content").children('div:not(.disabled):first').children("a"));
                            // Stop the loop
                            presentationLoop = false;
                        }
                    } else {
                        // Stop the loop
                        presentationLoop = false;
                    }
                }
                // Stop the loop
                loop = false
            }
        }
    } else if (currentMedia.length > 0) {
        // Get the current presentation
        var currentPresentation = $(".media.active").parent("a").parent("div").parent("div").parent("div");
        // Get the current presentation location
        var currentPresentationLocation = $(currentPresentation).attr("id");
        // Get the current presentation number
        var currentPresentationNumber = parseInt(currentPresentationLocation.split(":")[1]);
        // Create variable to determine loop status
        var presentationLoop = true;
        // Loop until a presentation is found or the presentations are exhausted
        while (presentationLoop) {
            // If the current presentation is at least the first
            if (currentPresentationNumber > 1) {
                // Decrease the presentation number
                currentPresentationNumber--;
                // Create the next presentation id
                var nextPresentationId = currentPresentationLocation.split(":")[0] + ":" + currentPresentationNumber;
                // Get the next presentation
                var nextPresentation = document.getElementById(nextPresentationId);
                // If the next presentation exists
                if (nextPresentation != null) {
                    // Trigger the first available slide of the next presentation
                    triggerSlide($(nextPresentation).children(".presentation-content").children('div:not(.disabled):first').children("a"));
                    // Stop the loop
                    presentationLoop = false;
                }
            } else {
                // Stop the loop
                presentationLoop = false;
            }
        }
    }
}

// Force Next Slide
function triggerNextSlide() {
    // Get the current slide
    var currentSlide = $(".slide-container.selected");
    // Get the current media
    var currentMedia = $(".media.active");
    // Check if the currently selected item is a presentation or media item
    if (currentSlide.length > 0) {
        // Get the current location
        var currentLocation = $(currentSlide).children("a").attr("id");
        // Get the current slide number
        var currentSlideNumber = parseInt($(currentSlide).find(".slide-number").text());
        // Get the total slide count
        var totalSlideCount = parseInt($(currentSlide).parent("div").children("div").length)
            // Check if this is a playlist or library presentation
        if (currentLocation.charAt(0) == '0') {
            var nextPresentation
                // Create variable to determine loop status
            var loop = true;
            // Loop until a slide is found or the slides are exhausted
            while (loop) {
                // If the current slide is at least the first, but is not the last
                if (currentSlideNumber > 0 && currentSlideNumber < totalSlideCount) {
                    // Increase the slide number
                    currentSlideNumber++;
                    // Create the next slide id
                    var nextSlideId = "slide" + currentSlideNumber + "." + currentLocation;
                    // If the next slide is not disabled
                    if (!$(document.getElementById(nextSlideId)).hasClass("disabled")) {
                        // Trigger the next slide
                        triggerSlide($(document.getElementById(nextSlideId)).children("a"));
                        // Stop the loop
                        loop = false;
                    }
                } else {
                    // Get the current presentation
                    var currentPresentation = $(".slide-container.selected").parent("div").parent("div");
                    // Get the current presentation location
                    var currentPresentationLocation = $(currentPresentation).attr("id");
                    // Get the current presentation number
                    var currentPresentationNumber = parseInt(currentPresentationLocation.split(":")[1]);
                    // Get the total presentation count
                    var totalPresentationCount = parseInt($(currentPresentation).parent("div").children("div").length)
                        // Create variable to determine loop status
                    var presentationLoop = true;
                    // Loop until a presentation is found or the presentations are exhausted
                    while (presentationLoop) {
                        // If the current presentation is at least the first, but is not the last
                        if (currentPresentationNumber > 0 && currentPresentationNumber < totalPresentationCount) {
                            // Increase the presentation number
                            currentPresentationNumber++;
                            // Create the next presentation id
                            var nextPresentationId = currentPresentationLocation.split(":")[0] + ":" + currentPresentationNumber;
                            // Get the next presentation
                            var nextPresentation = document.getElementById(nextPresentationId);
                            // If the next presentation exists
                            if (nextPresentation != null) {
                                // Trigger the first available slide of the next presentation
                                triggerSlide($(nextPresentation).children(".presentation-content").children('div:not(.disabled):first').children("a"));
                                // Stop the loop
                                presentationLoop = false;
                            }
                        } else {
                            // Stop the loop
                            presentationLoop = false;
                        }
                    }
                    // Stop the loop
                    loop = false
                }
            }
        } else {
            // Create variable to determine loop status
            var loop = true;
            // Loop until a slide is found or the slides are exhausted
            while (loop) {
                // If the current slide is at least the first, but is not the last
                if (currentSlideNumber > 0 && currentSlideNumber < totalSlideCount) {
                    // Increase the slide number
                    currentSlideNumber++;
                    // Create the next slide id
                    var nextSlideId = "slide" + currentSlideNumber + "." + currentLocation;
                    // If the next slide is not disabled
                    if (!$(document.getElementById(nextSlideId)).hasClass("disabled")) {
                        // Trigger the next slide
                        triggerSlide($(document.getElementById(nextSlideId)).children("a"));
                        // Stop the loop
                        loop = false;
                    }
                } else {
                    // Stop the loop
                    loop = false
                }
            }
        }
    } else if (currentMedia.length > 0) {
        // Get the current presentation
        var currentPresentation = $(".media.active").parent("a").parent("div").parent("div").parent("div");
        // Get the current presentation location
        var currentPresentationLocation = $(currentPresentation).attr("id");
        // Get the current presentation number
        var currentPresentationNumber = parseInt(currentPresentationLocation.split(":")[1]);
        // Get the total presentation count
        var totalPresentationCount = parseInt($(currentPresentation).parent("div").children("div").length)
            // Create variable to determine loop status
        var presentationLoop = true;
        // Loop until a presentation is found or the presentations are exhausted
        while (presentationLoop) {
            // If the current presentation is at least the first, but is not the last
            if (currentPresentationNumber > 0 && currentPresentationNumber < totalPresentationCount) {
                // Increase the presentation number
                currentPresentationNumber++;
                // Create the next presentation id
                var nextPresentationId = currentPresentationLocation.split(":")[0] + ":" + currentPresentationNumber;
                // Get the next presentation
                var nextPresentation = document.getElementById(nextPresentationId);
                // If the next presentation exists
                if (nextPresentation != null) {
                    // Trigger the first available slide of the next presentation
                    triggerSlide($(nextPresentation).children(".presentation-content").children('div:not(.disabled):first').children("a"));
                    // Stop the loop
                    presentationLoop = false;
                }
            } else {
                // Stop the loop
                presentationLoop = false;
            }
        }
    }
}

// Start Audio File Playback
function triggerAudio(obj) {
    var location = ($(obj).children("div").attr("id"));
    if (location.charAt(0) == '0') {
        remoteWebSocket.send('{"action":"audioStartCue","audioChildPath":"' + location + '"}');
        $("#audio-items").children("a").children("div").removeClass("selected");
        $("#audio-items").children("a").children("div").removeClass("highlighted");
    }

    $(".item.con").each(
        function() {
            if ($(this).attr("id") == location) {
                $(this).addClass("highlighted");
            }
        }
    );

    $(".item.lib.playlist.audio").each(
        function() {
            if ($(this).hasClass("selected")) {
                $(this).removeClass("selected")
                $(this).addClass("highlighted")
            }
        }
    );
}

// End Page Actions Functions


// Page Display Functions

function displayTimerOptions() {
    if ($("#timerOptions:visible").length == 0) {
        $("#messageOptions").hide();
        $("#stageOptions").hide();
        $("#settings").hide();
        $("#timerOptions").show();
    } else {
        $("#messageOptions").hide();
        $("#stageOptions").hide();
        $("#settings").hide();
        $("#timerOptions").hide();
    }
}

function displayMessageOptions() {
    if ($("#messageOptions:visible").length == 0) {
        $("#timerOptions").hide();
        $("#stageOptions").hide();
        $("#settings").hide();
        $("#messageOptions").show();
    } else {
        $("#timerOptions").hide();
        $("#stageOptions").hide();
        $("#settings").hide();
        $("#messageOptions").hide();
    }
}

function displayStageOptions() {
    if ($("#stageOptions:visible").length == 0) {
        $("#timerOptions").hide();
        $("#messageOptions").hide();
        $("#settings").hide();
        $("#stageOptions").show();
    } else {
        $("#timerOptions").hide();
        $("#messageOptions").hide();
        $("#settings").hide();
        $("#stageOptions").hide();
    }
}

function displaySettings() {
    if ($("#settings:visible").length == 0) {
        $("#timerOptions").hide();
        $("#messageOptions").hide();
        $("#stageOptions").hide();
        $("#settings").show();
    } else {
        $("#timerOptions").hide();
        $("#messageOptions").hide();
        $("#stageOptions").hide();
        $("#settings").hide();
    }
}

function displayMessage(obj) {
    $(".message-name").removeClass("selected").removeClass("highlighted");
    $(obj).children("div").addClass("selected");
}

function displayLibrary(obj) {
    // Get the current library name
    var current = $(obj).children("div").children(".name").text();
    // Create variable to hold library items
    var data = "";
    // Reset the item count
    $("#left-count").empty();
    // If set to only get names from ProPresenter libraries
    if (!retrieveEntireLibrary) {
        // Set the library item count
        if (libraryPresentationNameList.length == 1) {
            $("#left-count").append(libraryPresentationNameList.length + " Item");
        } else {
            $("#left-count").append(libraryPresentationNameList.length + " Items");
        }
        // Sort the presentations in the library by name
        libraryPresentationNameList.sort(SortPresentationByName);
        // For each Presentation Name in the array
        libraryPresentationNameList.forEach(function(item) {
            // Variable to hold the split string of the presentation path
            var pathSplit = item.presentationPath.split("/");
            // Iterate through each item in the split path to retrieve the library name
            pathSplit.forEach(function(element, index) {
                if (element == "Libraries") {
                    // If this presentation is from this library, add the data
                    if (pathSplit[index + 1] == current) {
                        data += '<a onclick="displayPresentation(this);"><div id="' + item.presentationPath + '" class="item con"><img src="img/presentation.png" /><div class="name">' + item.presentationName + '</div></div></a>';
                    }
                }
            });
        });
    } else {
        // Set the library item count
        if (libraryPresentationList.length == 1) {
            $("#left-count").append(libraryPresentationList.length + " Item");
        } else {
            $("#left-count").append(libraryPresentationList.length + " Items");
        }
        // Sort the presentations in the library by name
        libraryPresentationList.sort(SortPresentationByName);
        // For each Presentation in the array
        libraryPresentationList.forEach(function(item) {
            // Variable to hold the split string of the presentation path
            var pathSplit = item.presentationPath.split("/");
            // Iterate through each item in the split path to retrieve the library name
            pathSplit.forEach(function(element, index) {
                if (element == "Libraries") {
                    // If this presentation is from this library, add the data
                    if (pathSplit[index + 1] == current) {
                        data += '<a onclick="displayPresentation(this);"><div id="' + item.presentationPath + '" class="item con"><img src="img/presentation.png" /><div class="name">' + item.presentation.presentationName + '</div></div></a>';
                    }
                }
            });
        });
    }
    // Empty the library items area
    $("#library-items").empty();
    // Add the data to the library items area
    $("#library-items").append(data);
    // Show the library items area
    $("#playlist-items").hide();
    $("#library-items").show();
    // Remove selected and highlighted from libraries
    $(obj).parent().children("a").children("div").removeClass("selected");
    $(obj).parent().children("a").children("div").removeClass("highlighted");
    // Remove selected and highlighted from playlists
    $(".playlists").children("div").children("div").children("a").children("div").removeClass("selected");
    $(".playlists").children("div").children("div").children("a").children("div").removeClass("highlighted");
    // Set the library as selected
    $(obj).children("div").addClass("selected");
}

function displayPlaylist(obj) {
    // Get the current playlist name
    var current = $(obj).children("div").children(".name").text();
    // Create variable to hold playlist items
    var data = "";
    // Sort presentations in the playlist presentation list
    playlistPresentationList.sort(SortPresentationByPath);
    // Find the playlist in the array
    $(playlistList).each(
        function() {
            if (this.playlistName == current) {
                // Reset the item count
                $("#left-count").empty();
                // Get the new item count
                if (this.playlist.length == 1) {
                    $("#left-count").append((this.playlist).length + " Item");
                } else {
                    $("#left-count").append((this.playlist).length + " Items");
                }
                // Add the presentations in the playlist
                $(this.playlist).each(
                    function() {
                        if (this.playlistItemType == "playlistItemTypeHeader") {
                            data += '<a onclick="displayPresentation(this);"><div id="' + this.playlistItemLocation + '" class="item head"><div class="name">' + this.playlistItemName + '</div></div></a>'
                        } else if (this.playlistItemType == "playlistItemTypeVideo") {
                            data += '<a onclick="displayPresentation(this);"><div id="' + this.playlistItemLocation + '" class="item con"><img src="img/media.png" /><div class="name">' + this.playlistItemName + '</div></div></a>'
                        } else if (this.playlistItemType == "playlistItemTypePresentation") {
                            data += '<a onclick="displayPresentation(this);"><div id="' + this.playlistItemLocation + '" class="item con"><img src="img/presentation.png" /><div class="name">' + this.playlistItemName + '</div></div></a>'
                        }
                    }
                );
            }
        }
    );
    // Empty the content area
    $("#playlist-items").empty();
    // Add the content to the content area
    $("#playlist-items").append(data);

    // Hide the library items and show the playlist items
    $("#library-items").hide();
    $("#playlist-items").show();

    // Remove selected and highlighted from playlists
    $(obj).parent().children("a").children("div").removeClass("selected");
    $(obj).parent().children("a").children("div").removeClass("highlighted");
    // Remove selected and highlighted from libraries
    $(".libraries").children("div").children("a").children("div").removeClass("selected");
    $(".libraries").children("div").children("a").children("div").removeClass("highlighted");
    // Set the playlist as selected
    $(obj).children("div").addClass("selected");
}

function displayAudioPlaylist(obj) {
    // Get the current playlist name
    var current = $(obj).children("div").children(".name").text();
    // Create variable to hold playlist items
    var data = "";
    // Reset the item count
    $("#right-count").empty();
    // Find the playlist in the array
    $(audioPlaylistList).each(
        function() {
            if (this.playlistName == current) {

                // Get the new item count
                if (this.playlist.length == 1) {
                    $("#right-count").append((this.playlist).length + " Item");
                } else {
                    $("#right-count").append((this.playlist).length + " Items");
                }
                // Add the presentations in the playlist
                $(this.playlist).each(
                    function() {
                        data += '<a onclick="triggerAudio(this);"><div id="' + this.playlistItemLocation + '" class="item con"><img src="img/clearaudio.png" /><div class="name">' + this.playlistItemName + '</div></div></a>'
                    }
                );
            }
        }
    );
    // Empty the content area
    $("#audio-items").empty();
    // Add the content to the content area
    $("#audio-items").append(data);

    // Remove selected and highlighted from playlists
    $(obj).parent().children("a").children("div").removeClass("selected");
    $(obj).parent().children("a").children("div").removeClass("highlighted");
    // Set the playlist as selected
    $(obj).children("div").addClass("selected");
}

function displayPresentation(obj) {
    // Create variable to hold presentation data
    var data = [];
    // Create object from the parameter
    var thisObject = obj;
    // Create the location variable
    var location = "";
    // Create the slide index variable
    var slideIndex = "";
    // Create a variable to hold if presentation request was ProPresenter initiated
    var propresenterRequest = false;
    // Check if item is a header
    header = $(obj).children("div").hasClass("head");
    // Get the current presentation location from the ID
    location = $(obj).children("div").attr("id");
    // Check the request origin
    if ($(obj).attr("onclick") == null) {
        // Set presentation request to propresenter
        propresenterRequest = true;
        if (obj.action == "presentationSlideIndex") {
            // Use the initial presentation location
            location = initialPresentationLocation;
            // Use the provided slide index
            slideIndex = parseInt(obj.slideIndex);
        } else if (obj.action == "presentationTriggerIndex") {
            // Use the presentationPath as the location
            location = obj.presentationPath;
            // Use the provided slide index
            slideIndex = obj.slideIndex
        }
    }
    // Remove selected and highlighted from libraries and playlists
    $(".libraries").children("div").children("div").children("a").children("div").removeClass("selected").removeClass("highlighted");
    $(".playlists").children("div").children("div").children("a").children("div").removeClass("selected").removeClass("highlighted");
    // Remove selected and highlighted from libary and playlist items
    $("#library-items").children("a").children("div").removeClass("selected").removeClass("highlighted");
    $("#playlist-items").children("a").children("div").removeClass("selected").removeClass("highlighted");

    // Check if we should follow ProPresenter
    if (followProPresenter) {
        // Check if a previous presentation request exists
        if (!previousPresentationRequest) {
            // Set a previous presentation request
            previousPresentationRequest = true;
            // Check if the presentation is a playlist or a library presentation
            if (location.charAt(0) == '0') {
                // Create a variable to hold the playlist location
                var playlistLocation = "";
                // Create a variable to hold the playlist length
                var playlistLength = "";
                // Iterate through each playlist in the array
                $(playlistList).each(
                    function() {
                        // Get the playlist name
                        var playlistName = this.playlistName;
                        // Get the current playlist
                        var currentPlaylist = this;
                        // Iterate through each element in the playlist
                        $(this.playlist).each(
                            function() {
                                if (this.playlistItemLocation == location) {
                                    // Set the playlist location
                                    playlistLocation = currentPlaylist.playlistLocation
                                        // Set the playlist location
                                    playlistLength = currentPlaylist.playlist.length;
                                    // Iterate through each playlist name
                                    $(".playlist").children(".name").each(
                                        function() {
                                            // If the playlist's name matches the current playlist name
                                            if (playlistName == $(this).text()) {
                                                // Get the playlist group's expander
                                                var playlistGroupAnchor = $(this).parent().parent().parent().children(".expander");
                                                // Set the playlist group to expanded
                                                $(playlistGroupAnchor).removeClass("collapsed").addClass("expanded");
                                                $(playlistGroupAnchor).children("i").removeClass("fa-caret-right");
                                                $(playlistGroupAnchor).children("i").addClass("fa-caret-down");
                                                // Display the playlist
                                                displayPlaylist($(this).parent().parent());
                                                // Add highlighted to playlist
                                                $(this).parent().addClass("highlighted");
                                            }
                                        }
                                    );
                                }
                            }
                        );
                    }
                );

                // For each Presentation in the playlist presentation array
                $(playlistPresentationList).each(
                    function() {

                        // If the presentation path matches the path of the selected presentation, set it as highlighted
                        if (this.presentationPath == location) {
                            // Iterate through each playlist item
                            $("#playlist-items").children("a").each(
                                function() {
                                    // If this presentation path matches the selected presentation's presentation path
                                    if ($(this).children("div").attr("id") == location) {
                                        if (propresenterRequest && obj.slideIndex.toString() != "") {
                                            // Set the presentation as highlighted
                                            $(this).children("div").addClass("highlighted");
                                        } else {
                                            // Set the presentation as selected
                                            $(this).children("div").addClass("selected");
                                        }
                                    }
                                }
                            );
                        }

                        // If continuous playlists are enabled
                        if (continuousPlaylist) {
                            // If this presentation is part of the selected presentation's playlist
                            if (this.presentationPath.split(":")[0] == playlistLocation) {
                                // Get the presentation path
                                var presentationPath = this.presentationPath;

                                // If the presentation is not already displayed
                                if (document.getElementById("presentation." + presentationPath) == null) {
                                    // Get the index of the presentation in the playlist
                                    var presentationIndex = parseInt(this.presentationPath.split(":")[1]);
                                    // Create the presentation container in the presentation data
                                    var presentationData = '<div id="presentation.' + presentationPath + '" class="presentation">' +
                                        '<div class="presentation-header padded">' + this.presentation.presentationName + '</div>' +
                                        '<div class="presentation-content padded">';
                                    // Create a variable to hold the slide count
                                    var count = 1;
                                    // Iterate through each slide group in the presentation
                                    $(this.presentation.presentationSlideGroups).each(
                                        function() {
                                            // Get the slide group color
                                            var colorArray = this.groupColor.split(" ");
                                            // Get the slide group name
                                            var groupName = this.groupName;
                                            // Iterate through each slide in the slide group
                                            $(this.groupSlides).each(
                                                function() {
                                                    // Add the slide to the presentation data
                                                    presentationData += '<div class="slide-sizer"><div id="slide' + count + '.' + presentationPath + '" class="slide-container ' + getEnabledValue(this.slideEnabled) + '"><a id="' + presentationPath + '" onclick="triggerSlide(this);"><div class="slide" style="border-color: rgb(' + getRGBValue(colorArray[0]) + ',' + getRGBValue(colorArray[1]) + ',' + getRGBValue(colorArray[2]) + ');"><img src="data:image/png;base64,' + this.slideImage + '" draggable="false"/><div class="slide-info" style="background-color: rgb(' + getRGBValue(colorArray[0]) + ',' + getRGBValue(colorArray[1]) + ',' + getRGBValue(colorArray[2]) + ');"><div class="slide-number">' + count + '</div><div class="slide-name">' + this.slideLabel + '</div></div></div></a></div></div>';
                                                    // Increase the slide count
                                                    count++;
                                                }
                                            );
                                        }
                                    );

                                    // Add the close tags to the presentation data
                                    presentationData += '</div></div>';
                                    // Add the presentation data to the array
                                    data.push({ presentationIndex: presentationIndex, presentationData: presentationData });
                                }
                            }

                        } else {
                            // If the presentation path matches the path of the selected presentation, set it as highlighted
                            if (this.presentationPath == location) {
                                // Get the presentation path
                                var presentationPath = this.presentationPath;
                                // If the presentation is already displayed
                                if (document.getElementById("presentation." + presentationPath) == null) {
                                    // Get the index of the presentation in the playlist
                                    var presentationIndex = parseInt(this.presentationPath.split(":")[1]);
                                    // Create the presentation container in the presentation data
                                    var presentationData = '<div id="presentation.' + presentationPath + '" class="presentation">' +
                                        '<div class="presentation-header padded">' + this.presentation.presentationName + '</div>' +
                                        '<div class="presentation-content padded">';
                                    // Create a variable to hold the slide count
                                    var count = 1;
                                    // Iterate through each slide group in the presentation
                                    $(this.presentation.presentationSlideGroups).each(
                                        function() {
                                            // Get the slide group color
                                            var colorArray = this.groupColor.split(" ");
                                            // Get the slide group name
                                            var groupName = this.groupName;
                                            // Iterate through each slide in the slide group
                                            $(this.groupSlides).each(
                                                function() {
                                                    // Add the slide to the presentation data
                                                    presentationData += '<div class="slide-sizer"><div id="slide' + count + '.' + presentationPath + '" class="slide-container ' + getEnabledValue(this.slideEnabled) + '"><a id="' + presentationPath + '" onclick="triggerSlide(this);"><div class="slide" style="border-color: rgb(' + getRGBValue(colorArray[0]) + ',' + getRGBValue(colorArray[1]) + ',' + getRGBValue(colorArray[2]) + ');"><img src="data:image/png;base64,' + this.slideImage + '" draggable="false"/><div class="slide-info" style="background-color: rgb(' + getRGBValue(colorArray[0]) + ',' + getRGBValue(colorArray[1]) + ',' + getRGBValue(colorArray[2]) + ');"><div class="slide-number">' + count + '</div><div class="slide-name">' + this.slideLabel + '</div></div></div></a></div></div>';
                                                    // Increase the slide count
                                                    count++;
                                                }
                                            );
                                        }
                                    );
                                    // Add the close tags to the presentation data
                                    presentationData += '</div></div>';
                                    // Add the presentation data to the array
                                    data.push({ presentationIndex: presentationIndex, presentationData: presentationData });
                                }
                            }
                        }
                    }
                );

                // Iterate through each header in the playlist header list
                $(playlistHeaderList).each(
                    function() {
                        // If continuous playlists are enabled
                        if (continuousPlaylist) {
                            // If the presentation path matches the path of the selected presentation, set it as highlighted
                            if (this.presentationPath == location) {
                                // Iterate through each playlist item
                                $("#playlist-items").children("a").each(
                                    function() {
                                        // If this presentation path matches the selected presentation's presentation path
                                        if ($(this).children("div").attr("id") == location) {
                                            // Set the presentation as selected
                                            $(this).children("div").addClass("selected");
                                        }
                                    }
                                );
                            }
                            // If this header is part of the selected presentation's playlist
                            if (this.presentationPath.split(":")[0] == playlistLocation) {
                                // Get the header path
                                var headerPath = this.presentationPath;
                                // If the header is already displayed
                                if (document.getElementById("header." + headerPath) == null) {
                                    // Get the index of the header in the playlist
                                    var headerIndex = parseInt(this.presentationPath.split(":")[1]);
                                    // Create the presentation container in the presentation data
                                    var headerData = '<div id="header.' + headerPath + '">' +
                                        '<div class="header-header padded">' + this.presentation.presentationName + '</div>' +
                                        '</div>';
                                    // Add the header data to the array
                                    data.push({ presentationIndex: headerIndex, presentationData: headerData });
                                }
                            }
                        }
                    }
                );

                // Iterate through each media item in the playlist media list
                $(playlistMediaList).each(
                    function() {
                        // If continuous playlists are enabled
                        if (continuousPlaylist) {
                            // If the presentation path matches the path of the selected presentation, set it as highlighted
                            if (this.presentationPath == location) {
                                // Iterate through each playlist item
                                $("#playlist-items").children("a").each(
                                    function() {
                                        // If this presentation path matches the selected presentation's presentation path
                                        if ($(this).children("div").attr("id") == location) {
                                            if (propresenterRequest && obj.slideIndex.toString() != "") {
                                                // Set the presentation as highlighted
                                                $(this).children("div").addClass("highlighted");
                                            } else {
                                                // Set the presentation as selected
                                                $(this).children("div").addClass("selected");
                                            }
                                        }
                                    }
                                );
                            }
                            // If this media item is part of the selected presentation's playlist
                            if (this.presentationPath.split(":")[0] == playlistLocation) {
                                // Get the media item path
                                var mediaPath = this.presentationPath;
                                // If the media item is already displayed
                                if (document.getElementById("presentation." + mediaPath) == null) {
                                    // Get the index of the media item in the playlist
                                    var mediaIndex = parseInt(this.presentationPath.split(":")[1]);
                                    // Create the presentation container in the presentation data
                                    var mediaData = '<div id="presentation.' + mediaPath + '">' +
                                        '<div class="presentation-header padded">' + this.presentation.presentationName + '</div>' +
                                        '<div class="presentation-content padded">' +
                                        '<div id="media.' + mediaPath + '" class="media-container "><a id="' + mediaPath + '" onclick="triggerSlide(this);"><div class="media"><i class="far fa-play-circle"></i></div><div class="media-name">' + this.presentation.presentationName + '</div></a></div>' +
                                        '</div></div>';
                                    // Add the media data to the array
                                    data.push({ presentationIndex: mediaIndex, presentationData: mediaData });
                                }
                            }
                        }
                    }
                );

                if (data.length > 0 && data.length == playlistLength) {
                    // Sort the playlist presentations
                    data.sort(SortPresentationByIndex);
                    // Empty the presentation content area
                    $("#presentations").empty();
                    // For each presentation in the presentation data array
                    data.forEach(
                        function(item) {
                            // Add the presentation data to the presentations section
                            $("#presentations").append(item.presentationData);
                        }
                    );
                }
            } else {
                // Get the library
                var library;
                // Iterate through each library
                $(".libraries").children("div").children("a").each(
                    function() {
                        var libraryName = $(this).text();
                        // Split the string of the presentation path
                        var pathSplit = location.split("/");
                        // Iterate through each item in the split path to retrieve the library name
                        pathSplit.forEach(
                            function(pathElement, index) {
                                if (pathElement == "Libraries") {
                                    // If this presentation is from this library
                                    if (pathSplit[index + 1] == libraryName) {
                                        // Highlight the library
                                        $(".library").children(".name").each(
                                            function() {
                                                if (libraryName == $(this).text()) {
                                                    // Display the library
                                                    displayLibrary($(this).parent().parent());
                                                    // Add highlighted to library
                                                    $(this).parent().addClass("highlighted");
                                                }
                                            }
                                        );
                                    }
                                }
                            }
                        );
                    }
                );

                // If set to only get names from ProPresenter libraries
                if (!retrieveEntireLibrary) {
                    // Create a variable to hold whether the presentation should be retrieved
                    var retrieve = true;
                    // Check if the presentation currently exists in the list
                    libraryPresentationList.forEach(
                        function(item) {
                            // If the presentation exists
                            if (item.presentationPath == location) {
                                // Do not retrieve it
                                retrieve = false;
                            }
                        }
                    );
                    // If we should retrieve the presentation
                    if (retrieve) {
                        // Show downloading status
                        $("#status").attr("class", "downloading-library");
                        // Add this library item location to the requests array
                        libraryRequests.push(location);
                        // Empty the presentation display request list
                        presentationDisplayRequest = [];
                        // Add the location to the presentation display request list
                        presentationDisplayRequest.push(location);
                        // Add the index to the presentation display request list
                        presentationDisplayRequest.push(slideIndex);
                        // Get the presentation from the library
                        getPresentation(location);
                    }
                }


                // For each Presentation in the array
                $(libraryPresentationList).each(
                    function() {
                        // If the presentation path matches the path of the selected presentation, set it as highlighted
                        if (this.presentationPath == location) {
                            // Iterate through each library item
                            $("#library-items").children("a").each(
                                function() {
                                    // If this presentation path matches the selected presentation's presentation path
                                    if ($(this).children("div").attr("id") == location) {
                                        if (propresenterRequest && obj.slideIndex.toString() != "") {
                                            // Set the presentation as highlighted
                                            $(this).children("div").addClass("highlighted");
                                        } else {
                                            // Set the presentation as selected
                                            $(this).children("div").addClass("selected");
                                        }
                                    }
                                }
                            );
                            // Get the presentation path
                            var presentationPath = this.presentationPath;
                            // If the presentation is already displayed
                            if (document.getElementById("presentation." + presentationPath) == null) {
                                // Create the presentation container in the presentation data
                                var presentationData = '<div id="presentation.' + presentationPath + '" class="presentation">' +
                                    '<div class="presentation-header padded">' + this.presentation.presentationName + '</div>' +
                                    '<div class="presentation-content padded">';
                                // Create a variable to hold the slide count
                                var count = 1;
                                // Iterate through each slide group in the presentation
                                $(this.presentation.presentationSlideGroups).each(
                                    function() {
                                        // Get the slide group color
                                        var colorArray = this.groupColor.split(" ");
                                        // Get the slide group name
                                        var groupName = this.groupName;
                                        // Iterate through each slide in the slide group
                                        $(this.groupSlides).each(
                                            function() {
                                                // Add the slide to the presentation data
                                                presentationData += '<div class="slide-sizer"><div id="slide' + count + '.' + location + '" class="slide-container ' + getEnabledValue(this.slideEnabled) + '"><a id="' + location + '" onclick="triggerSlide(this);"><div class="slide" style="border-color: rgb(' + getRGBValue(colorArray[0]) + ',' + getRGBValue(colorArray[1]) + ',' + getRGBValue(colorArray[2]) + ');"><img src="data:image/png;base64,' + this.slideImage + '" draggable="false"/><div class="slide-info" style="background-color: rgb(' + getRGBValue(colorArray[0]) + ',' + getRGBValue(colorArray[1]) + ',' + getRGBValue(colorArray[2]) + ');"><div class="slide-number">' + count + '</div><div class="slide-name">' + this.slideLabel + '</div></div></div></a></div></div>';
                                                // Increase the slide count
                                                count++;
                                            }
                                        );
                                    }
                                );

                                // Add the close tags to the presentation data
                                presentationData += '</div></div>';
                                // Empty the presentation content area
                                $("#presentations").empty();
                                // Add the presentation data to the presentations section
                                $("#presentations").append(presentationData);
                            }
                        }
                    }
                );
            }
            previousPresentationRequest = false;
        }

        // If the presentation exists in the middle segment
        if (document.getElementById("presentation." + location) != null) {
            // Scroll the presentation into view
            document.getElementById("presentation." + location).scrollIntoView();
        }

        // Hide the left menu - MOBILE ONLY
        document.getElementById("sections").style.width = "0";

        // Set the slide columns
        setslideCols(slideCols);
    }

    // If the request is from ProPresenter
    if (propresenterRequest) {
        // Remove selected from any previous slides
        $(".slide-container").removeClass("selected");
        // Remove active from any previous media
        $(".media").removeClass("active");
        // Set the current slide
        setCurrentSlide(parseInt(obj.slideIndex) + 1, location);
        // If there is a slide index
        if (obj.slideIndex != "") {
            // Set clear slide to active
            $("#clear-slide").addClass("activated");
            // Set clear all to active
            $("#clear-all").addClass("activated");
        }
    } else {
        // If this is a header
        if (header) {
            // Scroll the header into view
            document.getElementById("header." + location).scrollIntoView();
        }

        // Remove selected and highlighted from all playlist/library items
        $(obj).parent().children("a").children("div").removeClass("selected").removeClass("highlighted");
        // Set the current playlist/library item as selected
        $(obj).children("div").addClass("selected");
    }
}

// End Page Display Functions


// Utility Functions

function getRGBValue(int) {
    return Math.round(255 * int);
}

function setslideCols(int) {
    $(".slide-sizer").width("calc(calc(100% - 2px) / "+int+")");
}

function SortPresentationByName(a, b) {
    // If set to only get names from ProPresenter libraries
    if (!retrieveEntireLibrary) {
        var aName = a.presentationName.toLowerCase();
        var bName = b.presentationName.toLowerCase();
        return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
    } else {
        var aName = a.presentation.presentationName.toLowerCase();
        var bName = b.presentation.presentationName.toLowerCase();
        return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
    }
}

function SortPresentationByPath(a, b) {
    var aName = a.presentationPath.toLowerCase();
    var bName = b.presentationPath.toLowerCase();
    return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
}

function SortPresentationByIndex(a, b) {
    var aIndex = a.presentationIndex;
    var bIndex = b.presentationIndex;
    return ((aIndex < bIndex) ? -1 : ((aIndex > bIndex) ? 1 : 0));
}

function getLocation(obj) {
    // Return the current presentation location
    return $(obj).children("div").attr("id");
}

function getClockSmallFormat(obj) {
    if (obj.length > 6) {
        return obj.split(".")[0];
    } else {
        return obj;
    }
}

function getClockOverrun(obj) {
    if (obj == true) {
        return "checked";
    } else {
        return "";
    }
}

function getClockEndTimeFormat(obj) {
    var endTimeFormatted = getClockSmallFormat(obj);
    if (endTimeFormatted == "00:00:00") {
        return "";
    } else {
        return endTimeFormatted;
    }
}

function clockMilisecondsCountdown(obj) {
    var ms = parseInt($(obj).text().split(".")[1]);
    var millisecondCount = setInterval(
        function() {
            if (ms > 0) {
                ms -= 1;
            } else {
                ms = 100;
            }
            var msString = ms.toString();
            if (msString.length < 2) {
                msString = "0" + msString;
            }
            time = $(obj).text().split(".")[0];
            $(obj).text(time + "." + msString);
        },
        10
    );
    setTimeout(
        function() {
            clearInterval(millisecondCount);
        },
        1000
    );
}

function webMessages() {
    window.open("http://" + host + ":" + port + "/html/pages/messages", '_blank');
}

// Prevent input fields from affecting slide progression
function preventInputInterference() {
    // When an input is in focus
    $("input").focus(
        function() {
            // Set input typing as active
            inputTyping = true;
        }
    );
    // When an input is out of focus
    $("input").focusout(
        function() {
            // Set input typing as inactive
            inputTyping = false;
        }
    );
}

function isElementInViewport(el) {
    // Special bonus for those using jQuery
    if (typeof jQuery === "function" && el instanceof jQuery) {
        el = el[0];
    }
    var rect = el.getBoundingClientRect();
    return (
        (rect.top) >= 0 &&
        rect.left >= 0 &&
        (rect.bottom) <= ((window.innerHeight || document.documentElement.clientHeight) - 200) && /* or $(window).height() */
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */
    );
}

function getEnabledValue(enabled) {
    if (enabled) {
        return "";
    } else {
        return "disabled";
    }
}

function removeArrayValue(arr) {
    var what, a = arguments,
        L = a.length,
        ax;
    while (L > 1 && arr.length) {
        what = a[--L];
        while ((ax = arr.indexOf(what)) !== -1) {
            arr.splice(ax, 1);
        }
    }
    return arr;
}

// End Utility Functions


// Navigation Functions

function openSideMenu() {
    // Increase the width of the side menu to display it
    document.getElementById("sections").style.width = "250px";
    // // Create a element click handler to allow the opening of the custom dropdown
    // window.addEventListener('click', function(e) {
    //     // If the clicked element is contained within the dropdown
    //     if (document.getElementById(obj.parentNode.id).contains(e.target)) {} else {
    //         // Hide the dropdown
    //         $(obj).parent("div").children(".type-dropdown").hide();
    //     }
    // });
}

function closeSideMenu() {
    // Decrease the width of the side menu to display it
    document.getElementById("sections").style.width = "0";
}

// End Navigation Functions


// Initialisation Functions

function initialise() {

    // If the window is likely on an iPad 2
    if (document.height == 768 || document.height == 1024) {
        // Hide the window title
        $('.window-title').hide();
        // Adjust the logo padding
        $('.logo').attr("style", "padding: 20px 10px 8px 10px;");
        // Adjust the logo image height
        $('.logo img').attr("style", "height: 33px;");
    }

    // Get Cookie Values
    getContinuousPlaylistCookie();
    getRetrieveEntireLibraryCookie();
    getForceSlidesCookie();
    getFollowProPresenterCookie();
    getUseCookiesCookie();
    getslideColsCookie();

    // Add listener for action keys
    window.addEventListener('keydown', function(e) {
        if (!inputTyping) {
            // When spacebar or right arrow is detected
            if (e.keyCode == 32 || e.keyCode == 39 && e.target == document.body) {
                // Prevent the default action
                e.preventDefault();
                if (forceSlides) {
                    triggerNextSlide();
                } else {
                    // Trigger the next slide
                    remoteWebSocket.send('{"action":"presentationTriggerNext"}');
                }
            }
            // When left arrow is detected
            if (e.keyCode == 37 && e.target == document.body) {
                // Prevent the default action
                e.preventDefault();
                if (forceSlides) {
                    triggerPreviousSlide();
                } else {
                    // Trigger the previous slide
                    remoteWebSocket.send('{"action":"presentationTriggerPrevious"}');
                }
            }
        }

        if (e.keyCode == 112) {
            // Prevent the default action
            e.preventDefault();
            // Send the clear all command
            clearAll();
        }
        if (e.keyCode == 113) {
            // Prevent the default action
            e.preventDefault();
            // Send the clear slide command
            clearSlide();
        }
        if (e.keyCode == 114) {
            // Prevent the default action
            e.preventDefault();
            // Send the clear media command
            clearMedia();
        }
        if (e.keyCode == 115) {
            // Prevent the default action
            e.preventDefault();
            // Send the clear props command
            clearProps();
        }
        if (e.keyCode == 116) {
            // Prevent the default action
            e.preventDefault();
            // Send the clear audio command
            clearAudio();
        }
        if (e.keyCode == 117) {
            // Prevent the default action
            e.preventDefault();
            // Send the clear messages command
            clearMessages();
        }
        if (e.keyCode == 118) {
            // Prevent the default action
            e.preventDefault();
            // Send the clear announcements command
            clearAnnouncements();
        }
    });

    // Make images non-draggable
    $("img").attr('draggable', false);

    // Add listener for slide columns slider
    document.getElementById("slide-cols").addEventListener('input',
        function(s) {
            // Get slide columns
            slideCols = (parseInt(document.getElementById("slide-cols").max)+1) - parseInt(this.value);
            // Set slide columns
            setslideCols(slideCols);
            // Set slide columns cookie
            setslideColsCookie(slideCols);
        }, false
    );
    // Prevent typing into inputs from affecting the slide progression
    preventInputInterference();
}

// When document is ready
$(document).ready(function() {
    initialise();
    connect();
});

// End Initialisation Functions
