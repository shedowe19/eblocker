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
export default {
    templateUrl: 'app/components/vpnHome/status/vpn-home-status.component.html',
    controller: Controller,
    controllerAs: 'vm'
};

function Controller(logger, VpnHomeService, NotificationService, DialogService, StateService, STATES) {
    'ngInject';
    'use strict';

    const OPENVPN_PORT = 1194;
    const WIREGUARD_PORT = 51820;
    const vm = this;
    vm.status = {isRunning: false, isFirstStart: false, host: null};
    vm.wireGuardStatus = {isRunning: false, isFirstStart: false, host: null};
    vm.resetServer = resetServer;
    vm.resetWireGuardServer = resetWireGuardServer;
    vm.toggleServerStatus = toggleServerStatus;
    vm.toggleWireGuardServerStatus = toggleWireGuardServerStatus;
    vm.repeatWizard = repeatWizard;
    vm.shortenHost = shortenHost;

    vm.isTestingConnection = false;
    vm.connectionOk = false;
    vm.connectionError = false;
    vm.testConnection = testConnection;
    vm.cancelTestConnection = cancelTestConnection;

    vm.$onInit = function() {
        loadMobileStatus();
    };

    function updateDisplayValues(status, mobilePort) {
        const prefix = 'ADMINCONSOLE.VPN_HOME_STATUS.';
        return {
            externalAddressConfig: {
                value: status.externalAddressType ? prefix + 'EXTERNAL_TYPES.' + status.externalAddressType : ''
            },
            ipOrHostConfig: {
                value: shortenHost(status.host || ''),
                valueUncut: status.host
            },
            ebMobilePortConfig: {
                value: String(mobilePort)
            },
            mappedPortConfig: {
                value: status.mappedPort
            },
            portForwardingConfig: {
                value: status.portForwardingMode === 'AUTO' ?
                    prefix + 'VALUE_FORWARDING_AUTO' : prefix + 'VALUE_FORWARDING_MAN'
            }
        };
    }

    function updateOpenVpnDisplayValues(status) {
        const values = updateDisplayValues(status, OPENVPN_PORT);
        vm.externalAddressConfig = values.externalAddressConfig;
        vm.ipOrHostConfig = values.ipOrHostConfig;
        vm.ebMobilePortConfig = values.ebMobilePortConfig;
        vm.mappedPortConfig = values.mappedPortConfig;
        vm.portForwardingConfig = values.portForwardingConfig;
    }

    function updateWireGuardDisplayValues(status) {
        const values = updateDisplayValues(status, WIREGUARD_PORT);
        vm.wireGuardExternalAddressConfig = values.externalAddressConfig;
        vm.wireGuardIpOrHostConfig = values.ipOrHostConfig;
        vm.wireGuardMobilePortConfig = values.ebMobilePortConfig;
        vm.wireGuardMappedPortConfig = values.mappedPortConfig;
        vm.wireGuardPortForwardingConfig = values.portForwardingConfig;
    }

    function shortenHost(longHost) {
        let shortHost = '';
        const numOfCharsBefore = 4;
        const numOfCharsAfter = 4;
        const split = longHost.split('.');
        const first = split[0];
        if (split.length > 1 && first.length > 9) {
            shortHost = shortHost.concat(first.slice(0, numOfCharsBefore));
            shortHost = shortHost.concat('...');
            shortHost = shortHost.concat(first.slice(first.length - numOfCharsAfter, first.length));
            for (let i = 1; i < split.length; i++) {
                shortHost = shortHost.concat('.' + split[i]);
            }
        } else {
            return longHost;
        }
        return shortHost;
    }

    function loadMobileStatus() {
        VpnHomeService.loadStatuses().then(function(statuses) {
            vm.status = statuses.openVpn;
            vm.wireGuardStatus = statuses.wireGuard;
            updateOpenVpnDisplayValues(vm.status);
            updateWireGuardDisplayValues(vm.wireGuardStatus);
        });
    }

    function resetServer(event) {
        DialogService.homeVpnReset(event, tryResetServer);
    }

    function resetWireGuardServer(event) {
        DialogService.homeVpnReset(event, tryResetWireGuardServer);
    }

    function tryResetServer() {
        return VpnHomeService.resetOpenVpnServer().then(function() {
            vm.status.isRunning = false;
            NotificationService.info('ADMINCONSOLE.VPN_HOME.NOTIFICATION.CONFIRMATION_RESET');
        }).finally(function updateMobileStatus() {
            loadMobileStatus();
        });
    }

    function tryResetWireGuardServer() {
        return VpnHomeService.resetWireGuardServer().then(function() {
            vm.wireGuardStatus.isRunning = false;
            NotificationService.info('ADMINCONSOLE.VPN_HOME.NOTIFICATION.CONFIRMATION_RESET');
        }).finally(function updateMobileStatus() {
            loadMobileStatus();
        });
    }

    function toggleServerStatus() {
        if (vm.status.isRunning && vm.status.isFirstStart) {
            openMobileWizard();
        } else {
            vm.isTogglingStatus = true;
            VpnHomeService.startStopOpenVpnServer(vm.status).then(function(response) {
                saved(response.data, vm.status, false);
            }, function() {
                cancelled(vm.status);
            }).finally(function() {
                vm.isTogglingStatus = false;
                updateOpenVpnDisplayValues(vm.status);
            });
        }
    }

    function toggleWireGuardServerStatus() {
        if (vm.wireGuardStatus.isRunning && vm.wireGuardStatus.isFirstStart) {
            openMobileWizard();
        } else {
            vm.isTogglingWireGuardStatus = true;
            VpnHomeService.startStopWireGuardServer(vm.wireGuardStatus).then(function(response) {
                saved(response.data, vm.wireGuardStatus, true);
            }, function() {
                cancelled(vm.wireGuardStatus);
            }).finally(function() {
                vm.isTogglingWireGuardStatus = false;
                updateWireGuardDisplayValues(vm.wireGuardStatus);
            });
        }
    }

    function saved(status, expectedStatus, isWireGuard) {
        // Expected new state doesn't match the current state => error
        if (status.isRunning !== expectedStatus.isRunning) {
            logger.error('New status ' + (status.isRunning ? '"running"' : '"not running"') + ' does not match' +
            ' expected old status ' + (expectedStatus.isRunning ? '"running"' : '"not running"'));
            NotificationService.error('ADMINCONSOLE.VPN_HOME.NOTIFICATION.INIT_FAILED');
        }
        if (isWireGuard) {
            vm.wireGuardStatus = status;
        } else {
            vm.status = status;
        }
    }

    function cancelled(status) {
        status.isRunning = false;
    }

    function openMobileWizard() {
        StateService.goToState(STATES.VPN_HOME_WIZARD);
    }

    function repeatWizard() {
        openMobileWizard();
    }

    function cancelTestConnection() {
        vm.connectionOk = false;
        vm.connectionError = false;
        vm.isTestingConnection = false;
        VpnHomeService.cancelConnectionTest();
    }

    function testConnection() {
        vm.connectionOk = false;
        vm.connectionError = false;
        vm.isTestingConnection = true;
        VpnHomeService.doConnectionTest().then(function success(response) {
            NotificationService.info('ADMINCONSOLE.VPN_HOME_STATUS.CONNECTION_TEST.NOTIFICATION.TEST_SUCCESS');
            vm.connectionOk = true;
            vm.connectionError = false;
        }, function error(response) {
            const errorDetails = VpnHomeService.getConnectionTestResult(response);
            NotificationService.error('ADMINCONSOLE.VPN_HOME_STATUS.CONNECTION_TEST.NOTIFICATION.TEST_ERROR',
                errorDetails);
            vm.connectionOk = false;
            vm.connectionError = true;
        }).finally(function done() {
            vm.isTestingConnection = false;
        });
    }
}
