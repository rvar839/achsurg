import SwiftUI

struct SettingsView: View {
    @Environment(Session.self) private var session
    @Environment(ProgressStore.self) private var progress
    @State private var confirmReset = false

    var body: some View {
        List {
            Section("Account") {
                LabeledContent("Signed in as", value: session.currentUser ?? "")
                Button("Sign out") {
                    session.logout()
                    progress.unload()
                }
            }
            Section {
                Button("Reset my progress", role: .destructive) { confirmReset = true }
            } footer: {
                Text("Clears your question history, flashcard schedule and analytics on this iPhone.")
            }
            Section("About") {
                LabeledContent("Version", value: AppConfig.version)
                Link("Website", destination: AppConfig.websiteURL)
                Link("Privacy Policy", destination: AppConfig.privacyURL)
                Link("Support", destination: AppConfig.supportURL)
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Reset all progress?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Reset", role: .destructive) { progress.reset() }
        } message: {
            Text("This cannot be undone.")
        }
    }
}

#Preview {
    NavigationStack { SettingsView() }
        .environment(Session())
        .environment(ProgressStore())
}
