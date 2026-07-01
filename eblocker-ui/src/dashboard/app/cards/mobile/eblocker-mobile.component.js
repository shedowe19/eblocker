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
    templateUrl: 'app/cards/mobile/eblocker-mobile.component.html',
    controllerAs: 'vm',
    controller: Controller,
    bindings: {
        cardId: '@'
    }
};

function Controller(logger, $timeout, $window, $q, CardService, VpnHomeService, DialogService, DeviceService,
                    NotificationService, deviceDetector) {
    'ngInject';
    'use strict';

    const vm = this;

    const CARD_NAME = 'MOBILE'; //'card-11';

    vm.downloadClientConf = downloadClientConf;
    vm.downloadOpenVpnClientConf = downloadOpenVpnClientConf;
    vm.downloadWireGuardClientConf = downloadWireGuardClientConf;
    vm.goToRecommendedApps = goToRecommendedApps;
    vm.isOpenVpnDownloadDisabled = isOpenVpnDownloadDisabled;
    vm.isWireGuardDownloadDisabled = isWireGuardDownloadDisabled;

    // type equals enum on server
    // name equals string from deviceDetector (except "other")
    // value is the String visible in UI
    vm.osTypes = [
        {type: 'WINDOWS', name: 'windows', value: 'Windows'},
        {type: 'MAC', name: 'mac', value: 'MacOS'},
        {type: 'IOS', name: 'ios', value: 'iOS'},
        {type: 'ANDROID', name: 'android', value: 'Android'},
        {type: 'OTHER', name: 'other', value: 'SHARED.MOBILE.DEVICE_TYPE.OTHER'}
    ];

    vm.$onInit = function() {
        loadStatus().then(function success() {
            return loadConfigurations();
        }).then(function success() {
            return loadDevice();
        });
        vm.operatingSystemType = getDeviceTypeObject(vm.osTypes, deviceDetector.os);
    };

    function getDeviceTypeObject(types, type) {
        let ret = vm.osTypes[4];
        types.forEach((item) => {
            if (item.name === type) {
                ret = item;
            }
        });
        return ret;
    }

    vm.$postLink = function() {
        $timeout(function() {
            CardService.scrollToCard(CARD_NAME);
        }, 300);
    };

    function loadStatus() {
        return VpnHomeService.loadStatuses().then(function success(statuses) {
            vm.vpnHomeStatus = statuses.openVpn;
            vm.wireGuardMobileStatus = statuses.wireGuard;
            return statuses;
        });
    }

    function loadDevice() {
        DeviceService.getDevice().then(function success(response) {
            if (angular.isObject(response.data)) {
                vm.device = response.data;
                vm.device.hasCertificate = angular.isDefined(vm.vpnHomeCertificates) &&
                    vm.vpnHomeCertificates.indexOf(vm.device.id) > -1;
                vm.device.hasWireGuardConfiguration = angular.isDefined(vm.wireGuardConfigurations) &&
                    vm.wireGuardConfigurations.indexOf(vm.device.id) > -1;
            }
        });
    }

    function goToRecommendedApps() {

    }

    function loadConfigurations() {
        const openVpnCertificates = isOpenVpnRunning() ?
            VpnHomeService.loadOpenVpnCertificates() : $q.resolve({data: []});
        const wireGuardConfigurations = isWireGuardRunning() ?
            VpnHomeService.loadWireGuardConfigurations() : $q.resolve({data: []});

        return $q.all([openVpnCertificates, wireGuardConfigurations]).then(function success(responses) {
            vm.vpnHomeCertificates = responses[0].data;
            vm.wireGuardConfigurations = responses[1].data;
            return responses;
        });
    }

    function isOpenVpnRunning() {
        return angular.isObject(vm.vpnHomeStatus) && vm.vpnHomeStatus.isRunning;
    }

    function isWireGuardRunning() {
        return angular.isObject(vm.wireGuardMobileStatus) && vm.wireGuardMobileStatus.isRunning;
    }

    function isOpenVpnDownloadDisabled() {
        return !isOpenVpnRunning() ||
            vm.vpnHomeStatus.isFirstStart ||
            vm.isDownloadingOpenVpnConf;
    }

    function isWireGuardDownloadDisabled() {
        return !isWireGuardRunning() ||
            vm.wireGuardMobileStatus.isFirstStart ||
            vm.isDownloadingWireGuardConf;
    }

    function downloadClientConf(device) {
        return downloadOpenVpnClientConf(device);
    }

    function downloadOpenVpnClientConf(device) {
        if (!angular.isString(vm.vpnHomeStatus.host) || vm.vpnHomeStatus.host === '') {
            NotificationService.error('MOBILE.CARD.NOTIFICATION.HOST_MISSING');
        } else {
            vm.isDownloadingOpenVpnConf = true;
            VpnHomeService.generateOpenVpnDownloadUrl(device.id, vm.operatingSystemType.type).
            then(function success(response) {
                $window.location = response.data;
            }, function error(response) {
                logger.error('OpenVPN mobile configuration download failed', response);
            }).finally(function done() {
                vm.isDownloadingOpenVpnConf = false;
            });
        }
    }

    function downloadWireGuardClientConf(device) {
        if (!angular.isString(vm.wireGuardMobileStatus.host) || vm.wireGuardMobileStatus.host === '') {
            NotificationService.error('MOBILE.CARD.NOTIFICATION.HOST_MISSING');
        } else {
            vm.isDownloadingWireGuardConf = true;
            VpnHomeService.generateWireGuardDownloadUrl(device.id, vm.operatingSystemType.type).
            then(function success(response) {
                $window.location = response.data;
            }, function error(response) {
                logger.error('WireGuard mobile configuration download failed', response);
            }).finally(function done() {
                vm.isDownloadingWireGuardConf = false;
            });
        }
    }
}
