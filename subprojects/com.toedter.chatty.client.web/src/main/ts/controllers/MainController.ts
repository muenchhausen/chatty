/**
 * Copyright (c) 2014 Kai Toedter
 * All rights reserved.
 * Licensed under MIT License, see http://toedter.mit-license.org/
 */

/// <reference path="../chatty.ts" />
/// <reference path="../model/ChatMessage.ts" />
/// <reference path="../model/ChattyScope.ts" />
/// <reference path="../services/LogService.ts" />
/// <reference path="../services/ChatMessageService.ts" />
/// <reference path="../services/UserService.ts" />
/// <reference path="../../../../typings/atmosphere/atmosphere.d.ts" />
/// <reference path="../../../../typings/angularjs/angular.d.ts" />

module chatty {
    export class MainController {
        static $inject = ['$scope', 'chatty.logService', 'chatty.chatMessageService', 'chatty.userService'];

        constructor($scope:ChattyScope, logService:LogService, chatMessageService:ChatMessageService, userService:UserService) {
            logService.log("Main controller started");

            $scope.userButtonText = 'Connect';
            $scope.isConnected = false;
            $scope.chatStatus = '';

            $scope.submitUser = () => {
                if (!$scope.isConnected) {
                    if ($scope.userId && $scope.userEmail && $scope.userFullName) {
                        $scope.connectedUser = undefined;
                        userService.connectUser({
                                id: $scope.userId,
                                email: $scope.userEmail,
                                fullName: $scope.userFullName
                            },
                            (userResource:chatty.model.UserResource, headers:Function) => {
                                console.log("got user: " + userResource.id);
                                $scope.connectedUserLocation = headers('Location');
                                $scope.connectedUser = userResource;
                                $scope.subSocket = socket.subscribe(request);
                            },
                            (result:any) => {
                                var alert:string = 'user id "' + $scope.userId + '" already in use, please choose another id';
                                $scope.chatStatus = alert;
                                $scope.chatStatusType = 'alert alert-danger';
                            });
                    } else {
                        var alert:string = 'Please fill in user id, email and full name.';
                        $scope.chatStatus = alert;
                        $scope.chatStatusType = 'alert alert-danger';
                    }
                } else {
                    userService.disconnectUser($scope.connectedUser,
                        () => {
                            $scope.subSocket.close();
                        });
                }
            }

            $scope.submitChatMessage = () => {
                if ($scope.connectedUser) {
                    console.log("chat message submitted: " + $scope.chatMessage);
                    chatMessageService.postMessage($scope.connectedUser, $scope.chatMessage, $scope.connectedUserLocation)
                }
            }

            chatMessageService.getAllChatMessages(
                (chatMessages:chatty.model.ChatMessage[]) => {
                    $scope.chatMessages = chatMessages;
                }
            );

            var socket:Atmosphere.Atmosphere = atmosphere;

            var request:Atmosphere.Request = {
                url: '/chatty/atmos/messages',
                contentType: 'application/json',
                logLevel: 'debug',
                transport: 'websocket',
                fallbackTransport: 'long-polling'
            };

            request.onOpen = function (response?:Atmosphere.Response) {
                var alert:string = 'Connected to server using: ' + response.transport;
                console.log(alert);
                $scope.chatStatus = alert;
                $scope.chatStatusType = 'alert-success';
                $scope.userButtonText = 'Disconnect';
                $scope.isConnected = true;
                $scope.$apply();
                // wait for the socket to be opened, then push a message using http post
            };

            request.onMessage = function (response:Atmosphere.Response) {
                var message:string = response.responseBody;
                console.log('Atmosphere got message: ' + message);
                var index = message.indexOf("ERROR");
                if (index != -1) {
                    console.log('Atmosphere got ERROR: ' + message);
                    return;
                }
                index = message.indexOf("{");
                if (index != 0 && index != -1) {
                    message = message.substring(index);
                } else {
                    return;
                }
                var messageObject:any = JSON.parse(message);

                if (messageObject.hasOwnProperty('command')) {
                    if (messageObject.command === 'reloadChatMessages') {
                        chatMessageService.getAllChatMessages((chatMessages:chatty.model.ChatMessage[]) => {
                            $scope.chatMessages = chatMessages;
                        });
                    }
                } else {
                    $scope.chatMessages.push(JSON.parse(message));
                }

                $scope.$apply();
            };

            request.onClose = function (response?:Atmosphere.Response) {
                var alert:string = 'Atmosphere socket closed'
                console.log(alert);
                $scope.chatStatus = alert;
                $scope.chatStatusType = 'alert-success';
                $scope.userButtonText = 'Connect';
                $scope.isConnected = false;
            };

            request.onError = function (response?:Atmosphere.Response) {
                console.log('Atmosphere error: ' + response.reasonPhrase);
            };
        }
    }
}

chatty.controllers.controller('chatty.mainController', chatty.MainController);
