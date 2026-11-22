import SwiftUI

struct SettingsView: View {
    var body: some View {
        List {
            Section("About") {
                LabeledContent("Version", value: AppConfig.version)
                Link("Website", destination: AppConfig.websiteURL)
            }
            Section("Legal") {
                Link("Privacy Policy", destination: AppConfig.privacyURL)
                Link("Support", destination: AppConfig.supportURL)
            }
        }
        .navigationTitle("Settings")
    }
}

#Preview { NavigationStack { SettingsView() } }
