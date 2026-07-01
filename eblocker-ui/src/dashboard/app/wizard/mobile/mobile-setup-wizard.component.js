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
export default {
    templateUrl: 'app/wizard/mobile/mobile-setup-wizard.component.html',
    controller: Controller,
    controllerAs: 'vm'
};

function Controller(logger, $state, $window, $translate, deviceDetector, DeviceService,
                    VpnHomeService, NotificationService, DialogService) {
    'ngInject';

    const vm = this;

    vm.finish = finish;
    vm.close = close;
    vm.backToDashboard = backToDashboard;
    vm.downloadClientConf = downloadClientConf;
    vm.nextStep = nextStep;
    vm.prevStep = prevStep;
    vm.getConfigFileName = getConfigFileName;
    vm.getOpenVPNName = getOpenVPNName;
    vm.getConfigurationName = getConfigurationName;
    vm.onProtocolChange = onProtocolChange;
    vm.getClientDownloadUrl = getClientDownloadUrl;
    vm.getSelectedProtocolLabel = getSelectedProtocolLabel;

    vm.isWindows = isWindows;
    vm.isIos = isIos;
    vm.isMac = isMac;
    vm.isAndroid = isAndroid;
    vm.isOther = isOther;
    vm.isOpenVpnSelected = isOpenVpnSelected;
    vm.isWireGuardSelected = isWireGuardSelected;

    vm.$onInit = function() {
        vm.currentStep = 1;
        vm.maxSteps = 7;
        vm.osTypes = [
            {type: 'WINDOWS', name: 'windows', value: 'Windows'},
            {type: 'MAC', name: 'mac', value: 'MacOS'},
            {type: 'IOS', name: 'ios', value: 'iOS'},
            {type: 'ANDROID', name: 'android', value: 'Android'}
            // ,
            // {type: 'OTHER', name: 'other', value: 'SHARED.MOBILE.DEVICE_TYPE.OTHER'}
        ];
        vm.protocols = [
            {type: VpnHomeService.WIREGUARD, value: 'WireGuard'},
            {type: VpnHomeService.OPENVPN, value: 'OpenVPN'}
        ];
        vm.mobileProtocol = vm.protocols[0];
        vm.deviceOs = getDeviceTypeObject(vm.osTypes, deviceDetector.os);
        loadStatuses().then(function() {
            chooseDefaultProtocol();
            return loadDevice();
        }).then(function success() {
            getConfigurationName(vm.device);
        });
    };

    function finish() {
        close(true);
    }

    function isWindows() {
        return vm.deviceOs.type === 'WINDOWS';
    }

    function isIos() {
        return vm.deviceOs.type === 'IOS';
    }

    function isMac() {
        return vm.deviceOs.type === 'MAC';
    }

    function isAndroid() {
        return vm.deviceOs.type === 'ANDROID';
    }

    function isOther() {
        return vm.deviceOs.type === 'OTHER';
    }

    function isOpenVpnSelected() {
        return angular.isObject(vm.mobileProtocol) && vm.mobileProtocol.type === VpnHomeService.OPENVPN;
    }

    function isWireGuardSelected() {
        return angular.isObject(vm.mobileProtocol) && vm.mobileProtocol.type === VpnHomeService.WIREGUARD;
    }

    function backToDashboard(event) {
        DialogService.closeMobileWizard(event, close);
    }

    function close(reload) {
        return $state.transitionTo('main', undefined, {
            location: true,
            inherit: true,
            reload: reload === true,
            relative: $state.$current,
            notify: reload === true
        }).catch(function(e) {
            logger.error('Could not transition to main: ' + e);
        });
    }

    function nextStep() {
        if (isNextStepAllowed(vm.currentStep, vm.maxSteps)) {

            if (vm.currentStep === 2 && (!isWindows() && !isMac())) {
                // skip step 3, which is only for Windows or Mac (install app)
                vm.currentStep = 4;
            } else if (vm.currentStep === 4 && (!isWindows() && !isMac())) {
                // skip step 5, which is only for Windows and Mac (install config)
                vm.currentStep = 6;
            } else {
                vm.currentStep++;
            }
        }
    }

    function prevStep() {
        if (vm.currentStep > 1) {
            if (vm.currentStep === 6 && (!isWindows() && !isMac())) {
                vm.currentStep = 4;
            } else if (vm.currentStep === 4 && (!isWindows() && !isMac())) {
                vm.currentStep = 2;
            } else {
                vm.currentStep--;
            }
        }
    }

    function isNextStepAllowed(current, max) {
        const num = current + 1;
        return num <= max;
    }

    function loadStatuses() {
        return VpnHomeService.loadStatuses().then(function success(statuses) {
            vm.vpnHomeStatus = statuses.openVpn;
            vm.wireGuardMobileStatus = statuses.wireGuard;
        }, function(response) {
            logger.error('Error loading mobile VPN status ', response);
        });
    }

    function chooseDefaultProtocol() {
        if (angular.isObject(vm.wireGuardMobileStatus) && vm.wireGuardMobileStatus.isRunning) {
            vm.mobileProtocol = vm.protocols[0];
        } else {
            vm.mobileProtocol = vm.protocols[1];
        }
    }

    function loadDevice() {
        return DeviceService.getDevice().then(function success(response) {
            if (angular.isObject(response.data)) {
                vm.device = response.data;
            }
        });
    }

    function getConfigFileName() {
        return vm.configurationFileName || '';
    }

    // STEP 2 -- Choose OS, download config

    function getDeviceTypeObject(types, type) {
        let ret = {name: 'other', value: 'SHARED.MOBILE.DEVICE_TYPE.OTHER'};
        types.forEach((item) => {
            if (item.name === type) {
                ret = item;
            }
        });
        return ret;
    }

    function getOpenVPNName(device) {
        return getConfigurationName(device);
    }

    function getConfigurationName(device) {
        if (!angular.isObject(device) || angular.isUndefined(device.id)) {
            NotificationService.error('WIZARD.MOBILE.CHOOSE_OS.NOTIFY_NO_DEVICE');
            return;
        }
        VpnHomeService.getFileName(device.id, vm.deviceOs.type, vm.mobileProtocol.type).
        then(function success(response) {
            vm.configurationFileName = response.data;
            vm.openVpnFileName = response.data;
        }, function(response) {
            logger.error('Error getting VPN file name ', response);
        });
    }

    function onProtocolChange() {
        getConfigurationName(vm.device);
    }

    function getSelectedProtocolLabel() {
        return angular.isObject(vm.mobileProtocol) ? vm.mobileProtocol.value : '';
    }

    function getClientDownloadUrl() {
        if (vm.mobileProtocol.type === VpnHomeService.WIREGUARD) {
            if (isWindows() || isMac()) {
                return 'https://www.wireguard.com/install/';
            }
            if (isIos()) {
                return 'https://apps.apple.com/app/wireguard/id1441195209';
            }
            if (isAndroid()) {
                return 'https://play.google.com/store/apps/details?id=com.wireguard.android';
            }
            return 'https://www.wireguard.com/install/';
        }
        return $translate.instant('WIZARD.MOBILE.CHOOSE_OS.VPN_URL.' + vm.deviceOs.type);
    }

    function downloadClientConf(device) {
        if (!angular.isObject(device)) {
            NotificationService.error('WIZARD.MOBILE.CHOOSE_OS.NOTIFY_NO_DEVICE');
            return;
        }
        vm.isDownloadingConf = true;
        VpnHomeService.generateDownloadUrl(device.id, vm.deviceOs.type, vm.mobileProtocol.type).
        then(function success(response) {
            $window.location = response.data;
        }, function error(response) {
            logger.error('Error downloading mobile VPN configuration ', response);
        }).finally(function done() {
            vm.isDownloadingConf = false;
        });
    }

}
