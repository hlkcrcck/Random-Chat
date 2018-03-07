var questionArea = document.getElementById('pick-one');
var chooseRed = document.getElementById('pick-red');
var chooseBlue = document.getElementById('pick-blue');

var myColor;
var friendColor;
var isColorPicked = false;
var mySide = document.getElementById('my-side');
var yourSide = document.getElementById('your-side');
var myVideo = document.getElementById('my-video');
var yourVideo = document.getElementById('your-video');
var myButton = document.getElementById('my-button');
var yourButton = document.getElementById('your-button');

var RTCPeerConnection = window.webkitRTCPeerConnection;
var localstream;
var servers = {'iceServers': [{'url': 'stun:stun.services.mozilla.com'}, {'url': 'stun:stun.l.google.com:19302'}, {'url': 'turn:numb.viagenie.ca', 'credential': 'websitebeaver', 'username': 'websitebeaver@email.com'}]};
var pc = new RTCPeerConnection(servers);

pc.onicecandidate = function (event) {
  if (event.candidate && friendID != null) {
	  sendData(myID, friendID, JSON.stringify({'ice': event.candidate}));
  }
}

pc.onaddstream = (event => yourVideo.srcObject = event.stream);

// Initialize Firebase
firebase.initializeApp(config);
var userDB = firebase.database();



	questionArea.parentNode.removeChild( questionArea );
	mySide.style.backgroundColor = "blue";
	myButton.style.backgroundColor = "red";
	yourSide.style.backgroundColor = "red";
	yourButton.style.backgroundColor = "blue";
	myColor = "blue";
	friendColor = "red";
	isColorPicked = true;



//Joining

var myID;
var joined = false;

function joinLeave() {
	if(isColorPicked){
		if(!joined){
			// getUserMedia connection
			navigator.mediaDevices.getUserMedia({audio:true, video:true})
				.then(stream => localstream = myVideo.srcObject = stream)
				.then(stream => pc.addStream(stream));

			//Design

			if(myColor == "blue"){
				myButton.style.backgroundColor = "blue";
			}else{
				myButton.style.backgroundColor = "red";
			}
			myButton.innerHTML = "Leave";
			joined = true;

		}else{

			//Stop MyVideo
			myVideo.pause();
			myVideo.srcObject = null;
			localstream.getTracks().forEach(function(track) { track.stop(); })

			//Stop YourVideo
			yourVideo.pause();
			yourVideo.srcObject = null;

			//MySide Design
			if(myColor == "blue"){
				myButton.style.backgroundColor = "red";
			}else{
				myButton.style.backgroundColor = "blue";
			}
			myButton.innerHTML = "Join";
			joined = false;

			//YourSide Design
			if(myColor == "blue"){
				yourButton.style.backgroundColor = "blue";
			}else{
				yourButton.style.backgroundColor = "red";
			}
			yourButton.innerHTML = "Call";
			called = false;

			//TODO: Unmatched(friend) on database

			//TOOD: Leave(Me) on database

		}
	}else{
		alert("Please, pick your color first.");
	}

}

//Calling
var called = false;
var matched = false;

function callHangup(){
	if(isColorPicked){
		if(joined){
					if(!called){

						called = true;

						//Connect to and register in database when first click to join
						if (myID == null){
							var data = {
								userColor: myColor,
								state: "unmatched",
								friendID: null
							}

							var pushing = userDB.ref('/users/' + myColor + "Users").push(data);
							myID = pushing.key;
						}

						//Design
						if(myColor == "blue"){
							yourButton.style.backgroundColor = "red";
						}else{
							yourButton.style.backgroundColor = "blue";
						}

						yourButton.innerHTML = "Waiting...";

					}else{

						//Stop YourVideo
						yourVideo.pause();
						yourVideo.srcObject = null;

						//YourSide Design
						if(myColor == "blue"){
							yourButton.style.backgroundColor = "blue";
						}else{
							yourButton.style.backgroundColor = "red";
						}
						yourButton.innerHTML = "Call";
						called = false;

						//TODO: Delete (both) on database, keep both joined

					}

		}else{
			alert("You need to join before you call someone.");
		}
	}else{
		alert("Please, pick your color first.");
	}
}

//DATABASE CONNECTION
var availableRed;
var availableBlue;
var friendID;
//checking newcomers and calling the function to match
userDB.ref('users/redUsers').on("child_added", goFirebase);
userDB.ref('users/blueUsers').on("child_added", goFirebase);

function goFirebase(snapshot) {
	availableRed = "none";
	availableBlue = "none";

	//check if there is any avalable red
	userDB.ref('users/redUsers').orderByKey().once('value', function(reds){
			reds.forEach(function(childSnapshot) {
				var childData = childSnapshot.val()
				if(childData.state == "unmatched" && availableRed == "none"){
					availableRed = childSnapshot.key;
				}
			});
	});

	//check if there is any avalable blue
	userDB.ref('users/blueUsers').orderByKey().once('value', function(blues){
			blues.forEach(function(childSnapshot) {
				var childData = childSnapshot.val()
				if(childData.state == "unmatched" && availableBlue == "none"){
					availableBlue = childSnapshot.key;
				}
			});
	});

	//match available users here if there are available red and blue
	if(availableRed != "none" && availableBlue != "none"){

		var redUpdate = {
			userColor: "red",
			state: "matched",
			friendID: availableBlue
		}

		var blueUpdate = {
			userColor: "blue",
			state: "matched",
			friendID: availableRed
		}

		userDB.ref('users/redUsers/' + availableRed).set(redUpdate);
		userDB.ref('users/blueUsers/' + availableBlue).set(blueUpdate);


	}

	//get friend's ID
	if(myColor == "red" && myID != null){
		userDB.ref('users/redUsers/' + myID).on('value', function(data){
			friendID = data.val().friendID;
			goCreateOffer(friendID);
		})
	}else if(myColor == "blue" && myID != null){
		userDB.ref('users/blueUsers/' + myID).on('value', function(data){
			friendID = data.val().friendID;
			goCreateOffer(friendID);
		})
	}
};

function goCreateOffer(friendid){
	pc.createOffer()
			.then(offer => pc.setLocalDescription(offer) )
			.then(() => sendData(myID, friendid, JSON.stringify({'sdp': pc.localDescription})) );
}

var videoDB = userDB.ref('/video');
function sendData(myID, receiverId, data) {
    var msg = videoDB.push({ sender: myID, receiver: receiverId, message: data });
    //msg.remove();
}

videoDB.on('child_added', readData);

function readData(data) {
		var msg = JSON.parse(data.val().message);
		var receiver = data.val().receiver;
		var sender = data.val().sender;

		if(receiver == myID){
			if (msg.ice != undefined)
				pc.addIceCandidate(new RTCIceCandidate(msg.ice));
			else if (msg.sdp.type == "offer"){
				pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
				  .then(() => pc.createAnswer())
				  .then(answer => pc.setLocalDescription(answer))
				  .then(() => sendData(myID, sender, JSON.stringify({'sdp': pc.localDescription})));
			}
			else if (msg.sdp.type == "answer")
				pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
		}
};
