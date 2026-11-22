import SwiftUI

struct HomeView: View {
    var body: some View {
        ContentUnavailableView {
            Label("Welcome to Absite", systemImage: "sparkles")
        } description: {
            Text("This is the starting point. The first real feature goes here.")
        }
        .navigationTitle("Absite")
    }
}

#Preview { NavigationStack { HomeView() } }
