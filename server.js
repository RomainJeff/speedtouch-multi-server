/**
 * SpeedTouch
 * @author Romain Quilliot <romain.addweb@gmail.com>
 * Tous droits réservés 2013
 */

var io = require('socket.io').listen(8080, { log: false });
var md5 = require('MD5');

console.log('Server running');

var users = [];
var stopped = true;
var play = false;
var owner = false;
var found = false;
var hasBuzzed = false;

io.sockets.on('connection', function (socket) {

    var me = false;

    // CONNEXION D'UN UTILISATEUR
    socket.on('login', function(result) {

        var userCount = getLength(users);

        if (play == true) {
            socket.emit('loginRefused', 'Une partie est deja en cours');
            return false;
        }

        if (users[result.pseudo]) {
            socket.emit('loginRefused', 'Ce pseudo est deja utilisé');
            return false;
        }

        me = result.pseudo;

        if (owner == false) {
            owner = me;
        }

        users[result.pseudo] = {
            pseudo: result.pseudo,
            email: result.email,
            avatar: md5(result.email),
            score: 0
        };

        console.log('Connexion de '+ users[me].pseudo);

        socket.emit('loginAccepted', me);
        socket.emit('newOwner', owner);
        socket.broadcast.emit('newUser', users[me]);

        for( var k in users) {
            socket.emit('newUser', users[k]);
        }

    });

    // DEBUT DE PARTIE
    socket.on('startPartie', function(user) {
        var userCount = getLength(users);

        if (user == owner && userCount >= 2) {
            play = true;
            console.log('Debut de partie');
            io.sockets.emit('startAccepted');

            buzzer(socket);
        }
    });

    // CLICK SUR ZONE DE CLICK
    socket.on('click', function(user){
        if (found != true && hasBuzzed == true && play == true) {
            found = true;
            users[user].score++;
            console.log( user +' gagne 1 point');

            for (var k in users) {
                if (users[k].score >= 9) {
                    play = false;
                    found = false;
                }
            }

            if (play == true) {
                io.sockets.emit('winner', user);
                buzzer(socket);
            } else {
                stopped = true;
                owner = false;
                hasBuzzed = false;
                play = false;
                console.log('Fin de la partie');
                users = resetScores(users);
                socket.broadcast.emit('newOwner', owner);
                io.sockets.emit('end', user);
            }
        }
    });

    // GET SCORE
    socket.on('getScore', function() {
        for(var k in users) {
            socket.emit('updateScore', {
                id: k,
                score: users[k].score
            });
        }
    });

    // DECONNEXION D'UN UTILISATEUR
    socket.on('disconnect', function() {
        if (me == false) {
            return false;
        }

        if (me == owner) {
            if (getLength(users) > 1) {
                var i = 0;
                for (var k in users) {
                    if (i == 1) {
                        owner = users[k].pseudo;
                    }
                    i++;
                }
                socket.broadcast.emit('newOwner', owner);
                console.log('Nouveau owner: '+ owner);
            } else {
                owner = 0;
            }
        }

        console.log('Deconnexion de '+ me);
        delete users[me];
        io.sockets.emit('disconnect', me);

        if (play == true) {
            if (getLength(users) < 2) {
                play = false;
                socket.broadcast.emit('errorConnected', "Pas assez de joueurs");
            }
        }
    });

});

/**
 *
 * Retourne le nombre d'utilisateurs connectes
 * @param users
 * @return int
 *
 */
function getLength(users)
{
    var i = 0;

    for(k in users) {
        i++;
    }

    return i;
}

/**
 *
 * Envois l'ordre de buzzer aux terminaux connectes
 * @param socket
 *
 */
function buzzer(socket)
{
    var delai = (Math.random() * 10000);

    if (delai <= 1000) {
        delai = delai + 1000;
    }

    setTimeout(function(){
        io.sockets.emit('buzzer');
        hasBuzzed = true;
        found = false;
        console.log('Buzz');
    }, delai);
}

/**
 *
 * Re-initialise les scores des utilisateurs
 * Redirige les utilisateurs sur la page d'accueil
 * @param users
 * @return object
 *
 */
function resetScores(users)
{
    for(var k in users) {
        io.sockets.emit('disconnect', k);
    }
    return {};
}
