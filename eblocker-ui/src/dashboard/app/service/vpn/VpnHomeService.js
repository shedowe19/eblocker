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
export default function VpnHomeService(logger, $http, $q, NotificationService, $interval, DataCachingService) {
    'ngInject';

    const OPENVPN = 'OPENVPN';
    const WIREGUARD = 'WIREGUARD';
    const PATHS = {};
    PATHS[OPENVPN] = '/api/dashboard/openvpn';
    PATHS[WIREGUARD] = '/api/dashboard/wireguard';
    const PATH_CONNECTION_TEST = PATHS[OPENVPN] + '/test';

    let openVpnStatusCache, wireGuardStatusCache;

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

    function getFileName(deviceId, osType, protocol) {
        return $http.get(getPath(protocol) + '/filename/' + deviceId + '/' + osType).
        then(standardSuccess, standardError);
    }

    function getOpenVpnFileName(deviceId, osType) {
        return getFileName(deviceId, osType, OPENVPN);
    }

    function getWireGuardFileName(deviceId, osType) {
        return getFileName(deviceId, osType, WIREGUARD);
    }

    function startStopServer(status, protocol) {
        return $http.post(getPath(protocol) + '/status', status).
        then(standardSuccess, function(response) {
            // NotificationService.error('ADMINCONSOLE.SERVICE.VPN_HOME.NOTIFICATION.SERVER_START', response);
            return $q.reject(response);
        });
    }

    function setStatus(status, protocol) {
        return $http.post(getPath(protocol) + '/status', status).
        then(standardSuccess, function(response) {
            // NotificationService.error('ADMINCONSOLE.SERVICE.VPN_HOME.NOTIFICATION.SERVER_POST', response);
            return $q.reject(response);
        });
    }

    function resetServer(protocol) {
        return $http.delete(getPath(protocol) + '/status').
        then(standardSuccess, function(response) {
            // NotificationService.error('ADMINCONSOLE.SERVICE.VPN_HOME.NOTIFICATION.SERVER_RESET', response);
            return $q.reject(response);
        });
    }

    function loadStatus(protocol) {
        const normalizedProtocol = normalizeProtocol(protocol);
        if (normalizedProtocol === WIREGUARD) {
            wireGuardStatusCache = DataCachingService.loadCache(wireGuardStatusCache, getPath(WIREGUARD) + '/status');
            return wireGuardStatusCache;
        }
        openVpnStatusCache = DataCachingService.loadCache(openVpnStatusCache, getPath(OPENVPN) + '/status');
        return openVpnStatusCache;
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
            // NotificationService.error('ADMINCONSOLE.SERVICE.VPN_HOME.NOTIFICATION.CERTIFICATES_GET', response);
            return $q.reject(response);
        });
    }

    function loadOpenVpnCertificates() {
        return loadCertificates(OPENVPN);
    }

    function loadWireGuardConfigurations() {
        return loadCertificates(WIREGUARD);
    }

    function revokeCertificate(deviceId) {
        return $http.delete(getPath(OPENVPN) + '/certificates/' + deviceId).
        then(standardSuccess, function(response) {
            // NotificationService.error('ADMINCONSOLE.SERVICE.VPN_HOME.NOTIFICATION.CERTIFICATES_DELETE', response);
            return $q.reject(response);
        });
    }

    function revokeWireGuardConfiguration(deviceId) {
        return $http.delete(getPath(WIREGUARD) + '/configurations/' + deviceId).
        then(standardSuccess, function(response) {
            return $q.reject(response);
        });
    }

    function generateDownloadUrl(deviceId, operatingSystemType, protocol) {
        const path = getPath(protocol) + getConfigurationsPath(protocol) + '/generateDownloadUrl/';
        return $http.get(path + deviceId + '/' + operatingSystemType).
        then(standardSuccess, function(response) {
            // NotificationService.error('ADMINCONSOLE.SERVICE.VPN_HOME.NOTIFICATION.CONFIG_DOWNLOAD', response);
            return $q.reject(response);
        });
    }

    function generateOpenVpnDownloadUrl(deviceId, operatingSystemType) {
        return generateDownloadUrl(deviceId, operatingSystemType, OPENVPN);
    }

    function generateWireGuardDownloadUrl(deviceId, operatingSystemType) {
        return generateDownloadUrl(deviceId, operatingSystemType, WIREGUARD);
    }

    /**
     * connectionTestPromise is resolved after the connection test returns distinct result.
     */
    let connectionTestPromise;
    function doConnectionTest() {
        connectionTestPromise = $q.defer();
        startConnectionTest().then(function success() {
            startPollingForConnectionStatus();
        }, function error(response) {
            connectionTestPromise.reject(response);
        });
        return connectionTestPromise.promise;
    }

    let connectionTestInterval, connectionTestIntervalSize = 1000,
        connectionTestIntervalRepeat = 20;
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
        return $http.post(PATH_CONNECTION_TEST);
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

    return {
        OPENVPN: OPENVPN,
        WIREGUARD: WIREGUARD,
        getProtocolName: getProtocolName,
        startStopServer: startStopServer,
        setStatus: setStatus,
        resetServer: resetServer,
        loadStatus: loadStatus,
        loadOpenVpnStatus: loadOpenVpnStatus,
        loadWireGuardStatus: loadWireGuardStatus,
        loadStatuses: loadStatuses,
        loadCertificates: loadCertificates,
        loadOpenVpnCertificates: loadOpenVpnCertificates,
        loadWireGuardConfigurations: loadWireGuardConfigurations,
        revokeCertificate: revokeCertificate,
        revokeWireGuardConfiguration: revokeWireGuardConfiguration,
        generateDownloadUrl: generateDownloadUrl,
        generateOpenVpnDownloadUrl: generateOpenVpnDownloadUrl,
        generateWireGuardDownloadUrl: generateWireGuardDownloadUrl,
        doConnectionTest: doConnectionTest,
        getConnectionTestResult: getConnectionTestResult,
        getOpenVpnFileName: getOpenVpnFileName,
        getWireGuardFileName: getWireGuardFileName,
        getFileName: getFileName
    };

    function standardSuccess(response) {
        return response;
    }

    function standardError(response) {
        return $q.reject(response);
    }
}
