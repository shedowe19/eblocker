/*
 * Copyright 2026 eBlocker Open Source UG (haftungsbeschraenkt)
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
package org.eblocker.server.common.vpn;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import org.eblocker.server.common.data.Device;
import org.eblocker.server.common.data.openvpn.VpnProfile;
import org.eblocker.server.common.data.openvpn.VpnStatus;
import org.eblocker.server.common.data.wireguard.WireGuardProfile;
import org.eblocker.server.common.openvpn.OpenVpnService;
import org.eblocker.server.common.wireguard.WireGuardService;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Protocol-neutral facade for VPN provider profiles.
 *
 * The historic OpenVPN implementation remains untouched. WireGuard is added as
 * a second provider type, while devices still reference VPN profiles by their
 * existing integer ID. WireGuard profile creation therefore allocates IDs from a
 * shared OpenVPN/WireGuard range to keep those device references unambiguous.
 */
@Singleton
public class VpnService {
    private final OpenVpnService openVpnService;
    private final WireGuardService wireGuardService;

    @Inject
    public VpnService(OpenVpnService openVpnService, WireGuardService wireGuardService) {
        this.openVpnService = openVpnService;
        this.wireGuardService = wireGuardService;
    }

    public Collection<VpnProfile> getVpnProfiles() {
        List<VpnProfile> profiles = new ArrayList<>();
        profiles.addAll(openVpnService.getVpnProfiles());
        profiles.addAll(wireGuardService.getVpnProfiles());
        return profiles;
    }

    public VpnProfile getVpnProfileById(int id) {
        VpnProfile openVpnProfile = openVpnService.getVpnProfileById(id);
        if (openVpnProfile != null) {
            return openVpnProfile;
        }
        return wireGuardService.getVpnProfileById(id);
    }

    public void startVpn(VpnProfile profile) {
        if (isWireGuard(profile)) {
            wireGuardService.startVpn(profile);
        } else {
            openVpnService.startVpn(profile);
        }
    }

    public void stopVpn(VpnProfile profile) {
        if (isWireGuard(profile)) {
            wireGuardService.stopVpn(profile);
        } else {
            openVpnService.stopVpn(profile);
        }
    }

    public void routeClientThroughVpnTunnel(Device device, VpnProfile profile) {
        if (isWireGuard(profile)) {
            wireGuardService.routeClientThroughVpnTunnel(device, profile);
        } else {
            openVpnService.routeClientThroughVpnTunnel(device, profile);
        }
    }

    public void restoreNormalRoutingForClient(Device device) {
        openVpnService.restoreNormalRoutingForClient(device);
        wireGuardService.restoreNormalRoutingForClient(device);
    }

    public VpnStatus getStatus(VpnProfile profile) {
        if (isWireGuard(profile)) {
            return wireGuardService.getStatus(profile);
        }
        return openVpnService.getStatus(profile);
    }

    public VpnStatus getStatusByDevice(Device device) {
        VpnStatus openVpnStatus = openVpnService.getStatusByDevice(device);
        if (openVpnStatus != null) {
            return openVpnStatus;
        }
        return wireGuardService.getStatusByDevice(device);
    }

    private boolean isWireGuard(VpnProfile profile) {
        return profile instanceof WireGuardProfile ||
                (profile != null && profile.getId() != null && wireGuardService.getVpnProfileById(profile.getId()) != null);
    }
}
