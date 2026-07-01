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
export default function VpnService($http, $q) {
    'ngInject';

    const OPENVPN = 'OPENVPN';
    const WIREGUARD = 'WIREGUARD';
    const OPENVPN_PATH = '/api/adminconsole/vpn/';
    const WIREGUARD_PATH = '/api/adminconsole/wireguard/';
    const OPENVPN_PROFILE = OPENVPN_PATH + 'profile';
    const WIREGUARD_PROFILE = WIREGUARD_PATH + 'profile';

    function createProfile(profile, vpnType) {
        const type = vpnType || profile.vpnType || OPENVPN;
        return $http.post(profileBase(type), profile).then(decorateSuccess(type), standardError);
    }

    function getProfile(profile) {
        return $http.get(profileBase(profile) + '/' + profile.id).then(decorateSuccess(profile), standardError);
    }

    function getProfiles() {
        return $q.all([
            $http.get(OPENVPN_PROFILE + 's'),
            $http.get(WIREGUARD_PROFILE + 's')
        ]).then(function(responses) {
            const openVpnProfiles = decorateProfiles(responses[0].data, OPENVPN);
            const wireGuardProfiles = decorateProfiles(responses[1].data, WIREGUARD);
            responses[0].data = openVpnProfiles.concat(wireGuardProfiles);
            return responses[0];
        }, standardError);
    }

    function updateProfile(profile) {
        return $http.put(profileBase(profile) + '/' + profile.id, profile).
        then(decorateSuccess(profile), standardError);
    }

    function deleteProfile(profile) {
        return $http.delete(profileBase(profile) + '/' + profile.id).then(standardSuccess, standardError);
    }

    function getProfileConfig(profile) {
        return $http.get(profileBase(profile) + '/' + profile.id + '/config').then(standardSuccess, standardError);
    }

    function uploadProfileConfig(profile, config) {
        return $http.put(profileBase(profile) + '/' + profile.id + '/config', config).
        then(standardSuccess, standardError);
    }

    function uploadProfileConfigOption(profile, optionParam, optionContent) {
        return $http.put(profileBase(profile) + '/' + profile.id + '/config/' + optionParam, optionContent).
        then(standardSuccess, standardError);
    }

    function setVpnStatus(profile, status) {
        return $http.put(profileBase(profile) + '/' + profile.id + '/status', status).
        then(standardSuccess, standardError);
    }

    function getVpnStatus(profile) {
        return $http.get(profileBase(profile) + '/' + profile.id + '/status').then(standardSuccess, standardError);
    }

    function getVpnDeviceStatus(profile, deviceId) {
        return $http.get(profileBase(profile) + '/' + profile.id + '/status/' + deviceId).
        then(standardSuccess, standardError);
    }

    function getVpnStatusByDeviceId(deviceId) {
        return $q.all([
            $http.get(OPENVPN_PROFILE + '/status/' + deviceId),
            $http.get(WIREGUARD_PROFILE + '/status/' + deviceId)
        ]).then(function(responses) {
            return responses[0].data ? responses[0] : responses[1];
        }, standardError);
    }

    function setVpnDeviceStatus(profile, deviceId, status) {
        return $http.put(profileBase(profile) + '/' + profile.id + '/status/' + deviceId, status).
        then(standardSuccess, standardError);
    }

    function updateCompletionStatus(dialog) {
        const tmpDialog = angular.copy(dialog);
        if (!tmpDialog.parsedOptions) {
            tmpDialog.configurationComplete = false;
        } else {
            const requiredFilesUploaded = angular.isUndefined(tmpDialog.parsedOptions.requiredFiles) ? true :
                !tmpDialog.parsedOptions.requiredFiles.find(function(e){
                return !e.uploaded || tmpDialog.requiredFileError[e.option];
            });
            const noValidationErrors = typeof tmpDialog.parsedOptions.validationErrors === 'undefined' ||
                tmpDialog.parsedOptions.validationErrors.length === 0;
            tmpDialog.configurationComplete = requiredFilesUploaded && noValidationErrors;
        }
        return tmpDialog;
    }

    return {
        OPENVPN: OPENVPN,
        WIREGUARD: WIREGUARD,
        getProfile: getProfile,
        getProfiles: getProfiles,
        createProfile: createProfile,
        updateProfile: updateProfile,
        deleteProfile: deleteProfile,
        getProfileConfig: getProfileConfig,
        uploadProfileConfig: uploadProfileConfig,
        uploadProfileConfigOption: uploadProfileConfigOption,
        setVpnStatus: setVpnStatus,
        getVpnStatus: getVpnStatus,
        getVpnDeviceStatus: getVpnDeviceStatus,
        setVpnDeviceStatus: setVpnDeviceStatus,
        updateCompletionStatus: updateCompletionStatus,
        getVpnStatusByDeviceId: getVpnStatusByDeviceId
    };

    function profileBase(profileOrType) {
        const type = angular.isString(profileOrType) ? profileOrType : profileOrType.vpnType;
        return type === WIREGUARD ? WIREGUARD_PROFILE : OPENVPN_PROFILE;
    }

    function decorateSuccess(profileOrType) {
        return function(response) {
            const type = angular.isString(profileOrType) ? profileOrType : profileOrType.vpnType;
            response.data = decorateProfile(response.data, type || OPENVPN);
            return response;
        };
    }

    function decorateProfiles(profiles, type) {
        return profiles.map(function(profile) {
            return decorateProfile(profile, type);
        });
    }

    function decorateProfile(profile, type) {
        if (angular.isObject(profile)) {
            profile.vpnType = type;
            profile.loginCredentials = profile.loginCredentials || {};
        }
        return profile;
    }

    function standardSuccess(response) {
        return response;
    }

    function standardError(response) {
        return $q.reject(response);
    }
}
