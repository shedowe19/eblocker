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
    templateUrl: 'app/components/vpnHome/wizard/vpn-home-wizard.component.html',
    controller: Controller,
    controllerAs: 'vm',
    bindings: {
        vpnHomeStatus: '<',
        wireGuardStatus: '<'
    }
};

function Controller(logger, StateService, STATES, VpnHomeService, NotificationService, DialogService, $q) { // jshint ignore: line
    'ngInject';

    const OPENVPN_PORT = 1194;
    const WIREGUARD_PORT = 51820;
    const vm = this;
    vm.openSaveWizardDialog = openSaveWizardDialog;
    vm.openCloseWizardDialog = openCloseWizardDialog;
    vm.goBack = goBack;
    vm.nextStep = nextStep;
    vm.prevStep = prevStep;
    vm.currentStep = 1; // XXX save for later if user cancels / continues
    vm.maxSteps = 7;

    vm.minPort = 1;
    vm.maxPort = 65535;

    vm.ACCESS_OPTIONS = {
        fixedIp: 'FIXED_IP',
        dynDns: 'DYN_DNS',
        ebDynDns: 'EBLOCKER_DYN_DNS'
    };

    vm.PORT_MAPPING_OPTIONS = {
        auto: 'AUTO',
        manual: 'MANUAL'
    };

    vm.$onInit = function() {
        vm.vpnHomeStatus = normalizeStatus(vm.vpnHomeStatus, OPENVPN_PORT);
        vm.wireGuardStatus = normalizeStatus(vm.wireGuardStatus, WIREGUARD_PORT);

        vm.vpnHomeStatus.isRunning = false;
        vm.wireGuardStatus.isRunning = false;

        vm.portMapping = vm.vpnHomeStatus.mappedPort;
        vm.wireGuardPortMapping = vm.wireGuardStatus.mappedPort;
        vm.accessType = vm.vpnHomeStatus.externalAddressType;
        vm.portMappingType = vm.vpnHomeStatus.portForwardingMode;

        syncWireGuardStatusFromOpenVpn();
        setVpnStatus(vm.vpnHomeStatus);
    };

    function normalizeStatus(status, defaultPort) {
        status = angular.isObject(status) ? status : {};
        status.portForwardingMode = status.portForwardingMode || vm.PORT_MAPPING_OPTIONS.auto;
        status.externalAddressType = status.externalAddressType || vm.ACCESS_OPTIONS.dynDns;
        status.mappedPort = angular.isNumber(status.mappedPort) ? status.mappedPort : defaultPort;
        status.host = angular.isString(status.host) ? status.host : '';
        status.isRunning = status.isRunning === true;
        status.isFirstStart = status.isFirstStart === true;
        return status;
    }

    function goBack() {
        return StateService.goToState(STATES.VPN_HOME);
    }

    function nextStep() {
        if (isNextStepAllowed()) {
            vm.currentStep++;
        }
    }

    function prevStep() {
        if (vm.currentStep > 1) {
            vm.currentStep--;
        }
    }

    function isNextStepAllowed() {
        const num = vm.currentStep + 1;
        return num <= vm.maxSteps;
    }

    function validateStatus(status) {
       const errors = [];
        syncWireGuardStatusFromOpenVpn();

        // HOST ERROR
        if (!angular.isString(status.host) || status.host === '') {
            errors.push('ADMINCONSOLE.VPN_HOME_WIZARD.STEP_SET_IP.ERROR.HOST_REQUIRED');
        }

        validatePort(status.mappedPort, errors);
        validatePort(vm.wireGuardStatus.mappedPort, errors);
        if (status.mappedPort === vm.wireGuardStatus.mappedPort) {
            errors.push('ADMINCONSOLE.VPN_HOME_WIZARD.STEP_DO_PORT_MAPPING.ERROR.PORT_COLLISION');
        }
        return errors;
    }

    function validatePort(port, errors) {
        if (!angular.isNumber(port)) {
            errors.push('ADMINCONSOLE.VPN_HOME_WIZARD.STEP_DO_PORT_MAPPING.ERROR.PORT_REQUIRED');
            errors.push('ADMINCONSOLE.VPN_HOME_WIZARD.STEP_DO_PORT_MAPPING.ERROR.PORT_NUMBER');
        } else if (port > vm.maxPort) {
            errors.push('ADMINCONSOLE.VPN_HOME_WIZARD.STEP_DO_PORT_MAPPING.ERROR.PORT_TOO_LARGE');
        } else if (port < vm.minPort) {
            errors.push('ADMINCONSOLE.VPN_HOME_WIZARD.STEP_DO_PORT_MAPPING.ERROR.PORT_TOO_SMALL');
        }
    }

    function openSaveWizardDialog(event) {
        DialogService.mobileWizardSaveConfirm(event, goBack, setVpnStatus, vm.vpnHomeStatus, validateStatus);
    }

    function openCloseWizardDialog(event) {
        DialogService.mobileWizardCloseConfirm(event, goBack, angular.noop);
    }

    function syncWireGuardStatusFromOpenVpn() {
        vm.wireGuardStatus.externalAddressType = vm.vpnHomeStatus.externalAddressType;
        vm.wireGuardStatus.host = vm.vpnHomeStatus.host;
        vm.wireGuardStatus.portForwardingMode = vm.vpnHomeStatus.portForwardingMode;
        vm.wireGuardStatus.mappedPort = vm.wireGuardPortMapping;
    }

    function setVpnStatus(status) {
        status.mappedPort = vm.portMapping;
        status.portForwardingMode = vm.portMappingType;
        status.externalAddressType = vm.accessType;
        syncWireGuardStatusFromOpenVpn();
        return $q.all([
            VpnHomeService.setOpenVpnStatus(status),
            VpnHomeService.setWireGuardStatus(vm.wireGuardStatus)
        ]);
    }

    // ************** STEP ACCESS: step 2 **************
    vm.accessShowMore = false;
    vm.accessToggleShowMore = accessToggleShowMore;
    vm.accessTypeChange = accessTypeChange;

    function accessTypeChange() {
        vm.vpnHomeStatus.externalAddressType = vm.accessType;
        vm.wireGuardStatus.externalAddressType = vm.accessType;
        vm.vpnHomeStatus.host = '';
        vm.wireGuardStatus.host = '';
    }

    function accessToggleShowMore() {
        vm.accessShowMore = !vm.accessShowMore;
    }
    // ############## END STEP ACCESS ##############



    // ************** STEP SET IP / HOSTNAME **************
    vm.ebDynConnectionConfirmed = false;

    vm.changeHost = function() {
        if (!vm.isHostNameOrIpValid()) {
            return;
        }
        vm.wireGuardStatus.host = vm.vpnHomeStatus.host;
        nextStep();
    };

    vm.isHostNameOrIpValid = function() {
        return vm.vpnHomeForm.$valid;
    };
    // ############## END STEP SET IP / HOSTNAME ##############



    // ************** STEP CHOOSE PORT MAPPING **************
    vm.choosePortMappingShowMore = false;
    vm.choosePortMappingToggleShowMore = choosePortMappingToggleShowMore;
    vm.portMappingTypeChange = portMappingTypeChange;

    function choosePortMappingToggleShowMore() {
        vm.choosePortMappingShowMore = !vm.choosePortMappingShowMore;
    }

    function portMappingTypeChange() {
        vm.vpnHomeStatus.portForwardingMode = vm.portMappingType;
        vm.wireGuardStatus.portForwardingMode = vm.portMappingType;
    }
    // ############## END STEP CHOOSE PORT MAPPING ##############



    // ************** STEP DO PORT MAPPING: step 5 **************
    vm.saveVpnStatusAndContinue = saveVpnStatusAndContinue;
    vm.onChangePort = onChangePort;
    vm.onChangeWireGuardPort = onChangeWireGuardPort;
    vm.hasPortCollision = hasPortCollision;
    vm.manuallyMappedPortsConfirm = false;
    vm.portsAreMapped = false;
    vm.portsMappingError = false;
    vm.eblockerMobilePortConfig = {
        value: String(OPENVPN_PORT)
    };
    vm.wireGuardMobilePortConfig = {
        value: String(WIREGUARD_PORT)
    };

    vm.mapPortsNow = mapPortsNow;
    function mapPortsNow() {
        if (hasPortCollision()) {
            vm.portsMappingError = true;
            NotificationService.
            error('ADMINCONSOLE.VPN_HOME_WIZARD.STEP_DO_PORT_MAPPING.NOTIFICATION.PORT_MAPPING_ERROR');
            return;
        }

        vm.isMappingPorts = true;
        vm.portsAreMapped = false;
        vm.portsMappingError = false;

        $q.all([
            VpnHomeService.setOpenVpnPortForwarding(vm.portMapping),
            VpnHomeService.setWireGuardPortForwarding(vm.wireGuardPortMapping)
        ]).then(function success(response) {
            NotificationService.
            info('ADMINCONSOLE.VPN_HOME_WIZARD.STEP_DO_PORT_MAPPING.NOTIFICATION.PORT_MAPPING_SUCCESS');
            vm.portsAreMapped = true;
            vm.portsMappingError = !vm.portsAreMapped;
            vm.isMappingPorts = false;
        }, function error(response) {
            logger.error('unable to set port forwarding', response);
            vm.portsMappingError = true;
            NotificationService.
            error('ADMINCONSOLE.VPN_HOME_WIZARD.STEP_DO_PORT_MAPPING.NOTIFICATION.PORT_MAPPING_ERROR', response);
            vm.isMappingPorts = false;// To stop the spinner eventually
        });
    }

    function saveVpnStatusAndContinue() {
        vm.isSavingConfig = true;
        setVpnStatus(vm.vpnHomeStatus).then(function() {
            nextStep();
        }).finally(function done() {
            vm.isSavingConfig = false;
        });
    }

    function onChangePort() {
        vm.manuallyMappedPortsConfirm = false;
        vm.portsAreMapped = false;
        vm.portsMappingError = false;
        vm.connectionOk = false;
        vm.connectionError = false;
        vm.vpnHomeStatus.mappedPort = vm.portMapping;
    }

    function onChangeWireGuardPort() {
        vm.manuallyMappedPortsConfirm = false;
        vm.portsAreMapped = false;
        vm.portsMappingError = false;
        vm.connectionOk = false;
        vm.connectionError = false;
        vm.wireGuardStatus.mappedPort = vm.wireGuardPortMapping;
    }

    function hasPortCollision() {
        return angular.isNumber(vm.portMapping) && angular.isNumber(vm.wireGuardPortMapping) &&
            vm.portMapping === vm.wireGuardPortMapping;
    }

    vm.isPortValid = function() {
        return vm.portMappingForm.$valid && !hasPortCollision();
    };
    // ############## END STEP DO PORT MAPPING ##############


    // ************** STEP TEST CONNECTION **************
    vm.testConnectionShowMore = false;
    vm.isTestingConnection = false;
    vm.connectionOk = false;
    vm.connectionError = false;
    vm.isTestingHostname = false;
    vm.hostnameOk = false;
    vm.hostnameError = false;
    vm.testConnectionToggleShowMore = testConnectionToggleShowMore;
    vm.testConnection = testConnection;
    vm.cancelTestConnection = cancelTestConnection;
    vm.testHostname = testHostname;
    vm.resetConnectionTestVars = resetConnectionTestVars;

    function testConnectionToggleShowMore() {
        vm.testConnectionShowMore = !vm.testConnectionShowMore;
    }

    function resetConnectionTestVars() {
        vm.connectionOk = false;
        vm.connectionError = false;
    }

    function cancelTestConnection() {
        resetConnectionTestVars();
        vm.isTestingConnection = false;
        VpnHomeService.cancelConnectionTest();
    }

    function testConnection() {
        vm.isTestingConnection = true;
        VpnHomeService.doConnectionTest().then(function success(response) {
            NotificationService.info('ADMINCONSOLE.VPN_HOME_WIZARD.STEP_CONNECTION_TEST.NOTIFICATION.TEST_SUCCESS');
            vm.connectionOk = true;
            vm.connectionError = false;
        }, function error(response) {
            if (response.customReason !== 'CANCELED') {
                const errorDetails = VpnHomeService.getConnectionTestResult(response);
                NotificationService.error('ADMINCONSOLE.VPN_HOME_WIZARD.STEP_CONNECTION_TEST.NOTIFICATION.TEST_ERROR',
                    errorDetails);
                vm.connectionOk = false;
                vm.connectionError = true;
            }
        }).finally(function done() {
            vm.isTestingConnection = false;
        });
    }

    function cancelTestHostname() {
        vm.isTestingHostname = false;
        vm.hostnameOk = false;
        vm.hostnameError = false;
        VpnHomeService.cancelHostNameTest();
    }

    function testHostname() {
        vm.isTestingHostname = true;
        VpnHomeService.doHostnameTest().then(function success() {
            NotificationService.info(
                'ADMINCONSOLE.VPN_HOME_WIZARD.STEP_CONNECTION_TEST.NOTIFICATION.TEST_HOSTNAME_SUCCESS'
            );
            vm.hostnameOk = true;
            vm.hostnameError = false;
        }, function error(technicalReason) {
            if (technicalReason.customReason !== 'CANCELED') {
                if (technicalReason) {
                    NotificationService.error(
                        'ADMINCONSOLE.VPN_HOME_WIZARD.STEP_CONNECTION_TEST.NOTIFICATION.TEST_HOSTNAME_ERROR'
                    );
                } else {
                    NotificationService.error(
                        'ADMINCONSOLE.VPN_HOME_WIZARD.STEP_CONNECTION_TEST.NOTIFICATION.TEST_HOSTNAME_FAILURE'
                    );
                }
                vm.hostnameOk = false;
                vm.hostnameError = true;
            }
        }).finally(function done() {
            vm.isTestingHostname = false;
        });
    }
    // ############## END STEP TEST CONNECTION ##############




    // ************** STEP FINISH **************
    vm.isLaunchError = false; // XXX save for later if user cancels / continues
    vm.isLaunchSuccess = false; // XXX save for later if user cancels / continues
    vm.isLaunching = false;
    vm.launchVpnServer = launchVpnServer;

    function launchVpnServer() {
        vm.nextStep();
        vm.isLaunching = true;
        // Start both mobile VPN servers.
        vm.vpnHomeStatus.isRunning = true;
        vm.wireGuardStatus.isRunning = true;

        setVpnStatus(vm.vpnHomeStatus).then(function success() {
            vm.isLaunchSuccess = true;
        }, function error() {
            vm.isLaunchError = !vm.isLaunchSuccess;
        }).finally(function done() {
            vm.isLaunching = false;
        });
    }
    // ############## END STEP FINISH ##############

}
