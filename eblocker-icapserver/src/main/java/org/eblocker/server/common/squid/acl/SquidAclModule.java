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
package org.eblocker.server.common.squid.acl;

import com.google.inject.AbstractModule;
import com.google.inject.Provides;
import com.google.inject.assistedinject.FactoryModuleBuilder;
import com.google.inject.name.Named;
import org.eblocker.server.common.data.IpAddress;
import org.eblocker.server.common.util.Ip4Utils;
import org.eblocker.server.http.service.DeviceService;

public class SquidAclModule extends AbstractModule {

    @Provides
    @Named("squid.acl.disabled.clients")
    public SquidAcl disabledClientsAcl(@Named("squid.disabled.acl.file.path") String path,
                                       DeviceService deviceService) {
        return new DevicePredicateFilterAcl(path, deviceService, device -> !device.isEnabled());
    }

    @Provides
    @Named("squid.acl.mobile.clients")
    public SquidAcl mobileClientsAcl(@Named("squid.mobile.acl.file.path") String path,
                                     DeviceService deviceService,
                                     @Named("network.vpn.subnet.ip") String vpnSubnet,
                                     @Named("network.vpn.subnet.netmask") String vpnNetmask,
                                     @Named("wireguard.mobile.peer.address.prefix") String wireGuardMobileAddressPrefix,
                                     @Named("wireguard.mobile.peer.address.ip6.prefix") String wireGuardMobileAddressIp6Prefix) {
        return new DevicePredicateFilterAcl(
                path, deviceService,
                device -> device.isEnabled() && device.isVpnClient(),
                ip -> isMobileVpnAddress(ip, vpnSubnet, vpnNetmask, wireGuardMobileAddressPrefix, wireGuardMobileAddressIp6Prefix));
    }

    @Provides
    @Named("squid.acl.mobile.clients.private.network.access")
    public SquidAcl mobileClientsPrivateNetworkAccessAcl(@Named("squid.mobile.private.network.access.acl.file.path") String path,
                                                         DeviceService deviceService,
                                                         @Named("network.vpn.subnet.ip") String vpnSubnet,
                                                         @Named("network.vpn.subnet.netmask") String vpnNetmask,
                                                         @Named("wireguard.mobile.peer.address.prefix") String wireGuardMobileAddressPrefix,
                                                         @Named("wireguard.mobile.peer.address.ip6.prefix") String wireGuardMobileAddressIp6Prefix) {
        return new DevicePredicateFilterAcl(
                path, deviceService,
                device -> device.isEnabled() && device.isVpnClient() && device.isMobilePrivateNetworkAccess(),
                ip -> isMobileVpnAddress(ip, vpnSubnet, vpnNetmask, wireGuardMobileAddressPrefix, wireGuardMobileAddressIp6Prefix));
    }

    private boolean isMobileVpnAddress(IpAddress ip,
                                       String vpnSubnet,
                                       String vpnNetmask,
                                       String wireGuardMobileAddressPrefix,
                                       String wireGuardMobileAddressIp6Prefix) {
        return isOpenVpnMobileAddress(ip, vpnSubnet, vpnNetmask)
                || hasPrefix(ip.toString(), wireGuardMobileAddressPrefix)
                || hasPrefix(ip.toString(), wireGuardMobileAddressIp6Prefix);
    }

    private boolean isOpenVpnMobileAddress(IpAddress ip, String vpnSubnet, String vpnNetmask) {
        return ip.isIpv4() && Ip4Utils.isInSubnet(ip.toString(), vpnSubnet, vpnNetmask);
    }

    private boolean hasPrefix(String address, String prefix) {
        return prefix != null && !prefix.isEmpty() && address.startsWith(prefix);
    }

    @Provides
    @Named("squid.acl.ssl.clients")
    public SquidAcl sslClientsAcl(@Named("squid.ssl.acl.file.path") String path,
                                  DeviceService deviceService) {
        return new DevicePredicateFilterAcl(path, deviceService, device -> device.isEnabled() && device.isSslEnabled());
    }

    @Provides
    @Named("squid.acl.tor.clients")
    public SquidAcl torClientsAcl(@Named("squid.tor.acl.file.path") String path,
                                  DeviceService deviceService) {
        return new DevicePredicateFilterAcl(path, deviceService, device -> device.isEnabled() && device.isUseAnonymizationService() && device.isRoutedThroughTor());
    }

    @Provides
    @Named("squid.acl.filtered.clients")
    public ConfigurableDeviceFilterAcl filteredClientsAcl(@Named("parentalcontrol.filtered.devices.file.path") String path,
                                                          DeviceService deviceService) {
        return new ConfigurableDeviceFilterAcl(path, deviceService);
    }

    @Override
    protected void configure() {
        install(new FactoryModuleBuilder().build(ConfigurableDeviceFilterAclFactory.class));
    }
}
