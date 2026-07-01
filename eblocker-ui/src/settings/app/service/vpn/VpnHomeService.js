/*
 * Copyright 2020 eBlocker Open Source UG (haftungsbeschraenkt)
 *
 * Licensed under the EUPL, Version 1.2 or - as soon they will be
 * approved by the European Commission - subsequent versions of the EUPL
 * (the "License"); You may not use this work except in compliance with
 * the License. You may obtain a copy of the License at:
 *
 *   https://joinup.ec.europa.eu/page/eupl-text-11-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */
/* jshint -W071 */
export default function VpnHomeService(logger, $http, $q, NotificationService, $interval) {
    'ngInject';

    const OPENVPN = 'OPENVPN';
    const WIREGUARD = 'WIREGUARD';
    const PATHS = {};
    PATHS[OPENVPN] = '/api/adminconsole/openvpn';
    PATHS[WIREGUARD] = '/api/adminconsole/wireguard';
    const PATH_CONNECTION_TEST = PATHS[OPENVPN] + '/test';
    const PATH_HOSTNAME_TEST = PATHS[OPENVPN] + '/dns';
    const STATUS_UPDATE_TIMEOUT = 60000; // one minute in ms

    function normalizeProtocol(protocol) {
        return protocol === WIREGUARD ? WIREGUARD : OPENVPN;
    }

    function getPath(protocol) {
        return PATHS[normalizeProtocol(protocol)];
    }

    function getConfigurationsPath(protocol) {
        return normalizeProtocol(protocol) === WIREGUARD ? '/configurations' : '/certificates';
    }

    function getProtocolName(protocol) {
        return normalizeProtocol(protocol) === WIREGUARD ? 'WireGuard' : 'OpenVPN';
    }

    function startStopServer(status, protocol) {
        return $http.post(getPath(protocol) + '/status', status, {timeout: STATUS_UPDATE_TIMEOUT}).
        then(standardSuccess, function(response) {
            NotificationService.error('ADMINCONSOLE.SERVICE.VPN_HOME.NOTIFICATION.SERVER_START', response);
            return $q.reject(response);
        });
    }

    function startStopOpenVpnServer(status) {
        return startStopServer(status, OPENVPN);
    }

    function startStopWireGuardServer(status) {
        return startStopServer(status, WIREGUARD);
    }

    function setStatus(status, protocol) {
        return $http.post(getPath(protocol) + '/status', status, {timeout: STATUS_UPDATE_TIMEOUT}).
        then(standardSuccess, function(response) {
            NotificationService.error('ADMINCONSOLE.SERVICE.VPN_HOME.NOTIFICATION.SERVER_POST', response);
            return $q.reject(response);
        });
    }

    function setOpenVpnStatus(status) {
        return setStatus(status, OPENVPN);
    }

    function setWireGuardStatus(status) {
        return setStatus(status, WIREGUARD);
    }

    function resetServer(protocol) {
        return $http.delete(getPath(protocol) + '/status').
        then(standardSuccess, function(response) {
            NotificationService.error('ADMINCONSOLE.SERVICE.VPN_HOME.NOTIFICATION.SERVER_RESET', response);
            return $q.reject(response);
        });
    }

    function resetOpenVpnServer() {
        return resetServer(OPENVPN);
    }

    function resetWireGuardServer() {
        return resetServer(WIREGUARD);
    }

    function loadStatus(protocol) {
        return $http.get(getPath(protocol) + '/status').
        then(standardSuccess, function(response) {
            NotificationService.error('ADMINCONSOLE.SERVICE.VPN_HOME.NOTIFICATION.SERVER_GET', response);
            return $q.reject(response);
        });
    }

    function loadOpenVpnStatus() {
        return loadStatus(OPENVPN);
    }

    function loadWireGuardStatus() {
        return loadStatus(WIREGUARD);
    }

    function loadStatuses() {
        return $q.all({
            openVpn: loadOpenVpnStatus().then(function(response) {
                return response.data;
            }),
            wireGuard: loadWireGuardStatus().then(function(response) {
                return response.data;
            })
        });
    }

    function loadCertificates(protocol) {
        return $http.get(getPath(protocol) + getConfigurationsPath(protocol)).
        then(standardSuccess, function(response) {
            NotificationService.error('ADMINCONSOLE.SERVICE.VPN_HOME.NOTIFICATION.CERTIFICATES_GET', response);
            return $q.reject(response);
        });
    }

    function loadOpenVpnCertificates() {
        return loadCertificates(OPENVPN);
    }

    function loadWireGuardConfigurations() {
        return loadCertificates(WIREGUARD);
    }

    function generateDownloadUrl(deviceId, operatingSystemType, protocol) {
        const path = getPath(protocol) + getConfigurationsPath(protocol) + '/generateDownloadUrl/';
        return $http.get(path + deviceId + '/' + operatingSystemType).
        then(standardSuccess, function(response) {
            NotificationService.error('ADMINCONSOLE.SERVICE.VPN_HOME.NOTIFICATION.CONFIG_DOWNLOAD', response);
            return $q.reject(response);
        });
    }

    function generateOpenVpnDownloadUrl(deviceId, operatingSystemType) {
        return generateDownloadUrl(deviceId, operatingSystemType, OPENVPN);
    }

    function generateWireGuardDownloadUrl(deviceId, operatingSystemType) {
        return generateDownloadUrl(deviceId, operatingSystemType, WIREGUARD);
    }

    function enableDevice(deviceId, protocol) {
        return $http.post(getPath(protocol) + '/enable/' + deviceId).
        then(standardSuccess, function(response) {
            NotificationService.error('ADMINCONSOLE.SERVICE.VPN_HOME.NOTIFICATION.ENABLE_DEVICE', response);
            return $q.reject(response);
        });
    }

    function enableOpenVpnDevice(deviceId) {
        return enableDevice(deviceId, OPENVPN);
    }

    function enableWireGuardDevice(deviceId) {
        return enableDevice(deviceId, WIREGUARD);
    }

    function enableDeviceForAllMobileVpn(deviceId) {
        return $q.all([
            enableOpenVpnDevice(deviceId),
            enableWireGuardDevice(deviceId)
        ]);
    }

    function disableDevice(deviceId, protocol) {
        return $http.post(getPath(protocol) + '/disable/' + deviceId).
        then(standardSuccess, function(response) {
            NotificationService.error('ADMINCONSOLE.SERVICE.VPN_HOME.NOTIFICATION.DISABLE_DEVICE', response);
            return $q.reject(response);
        });
    }

    function disableOpenVpnDevice(deviceId) {
        return disableDevice(deviceId, OPENVPN);
    }

    function disableWireGuardDevice(deviceId) {
        return disableDevice(deviceId, WIREGUARD);
    }

    function disableDeviceForAllMobileVpn(deviceId) {
        return $q.all([
            disableOpenVpnDevice(deviceId),
            disableWireGuardDevice(deviceId)
        ]);
    }

    function setPrivateNetworkAccess(deviceId, privateNetworkAccess, protocol) {
        return $http.put(getPath(protocol) + '/privateNetworkAccess/' + deviceId, privateNetworkAccess)
            .then(standardSuccess, function(response) {
                NotificationService
                    .error('ADMINCONSOLE.SERVICE.VPN_HOME.NOTIFICATION.PRIVATE_NETWORK_ACCESS', response);
                return $q.reject(response);
            });
    }

    function setPrivateNetworkAccessForAllMobileVpn(deviceId, privateNetworkAccess) {
        return $q.all([
            setPrivateNetworkAccess(deviceId, privateNetworkAccess, OPENVPN),
            setPrivateNetworkAccess(deviceId, privateNetworkAccess, WIREGUARD)
        ]).then(function(responses) {
            return responses[responses.length - 1];
        });
    }

    function setPortForwarding(port, protocol) {
        const normalizedProtocol = normalizeProtocol(protocol);
        const path = normalizedProtocol === WIREGUARD ?
            getPath(WIREGUARD) + '/upnp/' + port : '/api/adminconsole/upnpn/' + port;
        return $http.put(path).then(standardSuccess, function(response) {
            NotificationService.error('ADMINCONSOLE.SERVICE.VPN_HOME.NOTIFICATION.SERVER_POST', response);
            return $q.reject(response);
        });
    }

    function setOpenVpnPortForwarding(port) {
        return setPortForwarding(port, OPENVPN);
    }

    function setWireGuardPortForwarding(port) {
        return setPortForwarding(port, WIREGUARD);
    }

    let connectionTestInterval,
        connectionTestIntervalRepeat = 20;
    const connectionTestIntervalSize = 1000;

    /**
     * connectionTestPromise is resolved after the connection test returns distinct result.
     */
    let connectionTestPromise, testCancelled;
    function doConnectionTest() {
        testCancelled = false;
        connectionTestIntervalRepeat = 20;
        connectionTestPromise = $q.defer();
        startConnectionTest(connectionTestPromise).then(function success() {
            // don't even start to poll if user has cancelled before this promise has been resolved
            if (testCancelled !== true) {
                startPollingForConnectionStatus();
            }
        }, function error(response) {
            connectionTestPromise.reject(response);
        });
        return connectionTestPromise.promise;
    }

    function cancelConnectionTest() {
        if (angular.isFunction(connectionTestPromise.reject)) {
            connectionTestPromise.reject({customReason: 'CANCELED'});
        }
        testCancelled = true;
        stopConnectionTest();
        stopPollingForConnectionStatus();
    }

    function startPollingForConnectionStatus() {
        connectionTestInterval = $interval(pollForConnectionStatusUpdate, connectionTestIntervalSize);
    }

    function stopPollingForConnectionStatus() {
        if (angular.isDefined(connectionTestInterval)) {
            $interval.cancel(connectionTestInterval);
        }
        connectionTestInterval = undefined;
    }

    let lastStatus;
    function pollForConnectionStatusUpdate() {
        connectionTestIntervalRepeat--;
        logger.debug('Polling for connection test status (' + connectionTestIntervalRepeat + ' sec).');
        if (connectionTestIntervalRepeat <= 0) {
            logger.debug('Stop polling for connection test status');
            stopPollingForConnectionStatus();
            connectionTestPromise.reject({data: lastStatus});
        }

        getConnectionTestStatus().then(function success(response) {
            lastStatus = response.data;
            // const status = processConnectionStatus(response.data);
            const status = response.data.state;
            if (status === 'SUCCESS') {
                stopPollingForConnectionStatus();
                connectionTestPromise.resolve(response);
            } else if (status === 'ERROR' || status === 'FAILURE') {
                stopPollingForConnectionStatus();
                connectionTestPromise.reject(response);
            } else {
                logger.debug('Status not yet decided: ' + status);
            }
        });
    }

    function startConnectionTest() {
        return $http.post(PATH_CONNECTION_TEST, {timeout: connectionTestPromise.promise});
    }

    function stopConnectionTest() {
        return $http.delete(PATH_CONNECTION_TEST);
    }

    function getConnectionTestStatus() {
        return $http.get(PATH_CONNECTION_TEST);
    }

    function getConnectionTestResult(response) {
        const status = response.data;
        let data;
        if (angular.isDefined(status.udpMessagesSent) && angular.isDefined(status.tcpMessagesSent)) {
            data = 'UDP sent: ' + status.udpMessagesSent + ', received: ' + status.udpMessagesReceived + ' / ' +
                'TCP sent: ' + status.tcpMessagesSent + ', received: ' + status.tcpMessagesReceived;
        } else {
            data = status;
        }

        return {
            status: response.status ? response.status : '-',
            msg: response.msg ? response.msg : '-',
            data: data
        };
    }

    let hostTestPromise;
    function cancelHostNameTest() {
        if (angular.isFunction(hostTestPromise.reject)) {
            hostTestPromise.reject({customReason: 'CANCELED'});
        }
    }

    function doHostnameTest() {
        hostTestPromise = $q.defer();
        $http.post(PATH_HOSTNAME_TEST, {timeout: hostTestPromise.promise}).then(function(response) {
            logger.info('hostname result', response.data);
            if (response.data) {
                return hostTestPromise.resolve();
            } else {
                return hostTestPromise.reject(false);
            }
        }, function() {
            return hostTestPromise.reject(true);
        });
        return hostTestPromise.promise;
    }

    return {
        OPENVPN: OPENVPN,
        WIREGUARD: WIREGUARD,
        getProtocolName: getProtocolName,
        startStopServer: startStopServer,
        startStopOpenVpnServer: startStopOpenVpnServer,
        startStopWireGuardServer: startStopWireGuardServer,
        setStatus: setStatus,
        setOpenVpnStatus: setOpenVpnStatus,
        setWireGuardStatus: setWireGuardStatus,
        resetServer: resetServer,
        resetOpenVpnServer: resetOpenVpnServer,
        resetWireGuardServer: resetWireGuardServer,
        loadStatus: loadStatus,
        loadOpenVpnStatus: loadOpenVpnStatus,
        loadWireGuardStatus: loadWireGuardStatus,
        loadStatuses: loadStatuses,
        loadCertificates: loadCertificates,
        loadOpenVpnCertificates: loadOpenVpnCertificates,
        loadWireGuardConfigurations: loadWireGuardConfigurations,
        generateDownloadUrl: generateDownloadUrl,
        generateOpenVpnDownloadUrl: generateOpenVpnDownloadUrl,
        generateWireGuardDownloadUrl: generateWireGuardDownloadUrl,
        doConnectionTest: doConnectionTest,
        cancelConnectionTest: cancelConnectionTest,
        doHostnameTest: doHostnameTest,
        cancelHostNameTest: cancelHostNameTest,
        getConnectionTestResult: getConnectionTestResult,
        enableDevice: enableDevice,
        enableOpenVpnDevice: enableOpenVpnDevice,
        enableWireGuardDevice: enableWireGuardDevice,
        enableDeviceForAllMobileVpn: enableDeviceForAllMobileVpn,
        disableDevice: disableDevice,
        disableOpenVpnDevice: disableOpenVpnDevice,
        disableWireGuardDevice: disableWireGuardDevice,
        disableDeviceForAllMobileVpn: disableDeviceForAllMobileVpn,
        setPrivateNetworkAccess: setPrivateNetworkAccess,
        setPrivateNetworkAccessForAllMobileVpn: setPrivateNetworkAccessForAllMobileVpn,
        setPortForwarding: setPortForwarding,
        setOpenVpnPortForwarding: setOpenVpnPortForwarding,
        setWireGuardPortForwarding: setWireGuardPortForwarding
    };

    function standardSuccess(response) {
        return response;
    }
}
