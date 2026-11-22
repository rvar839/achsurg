import SwiftUI

struct LoginView: View {
    @Environment(Session.self) private var session
    @Environment(ProgressStore.self) private var progress
    @State private var selected: UserAccount?
    @State private var passcode = ""
    @State private var failed = false
    @FocusState private var passcodeFocused: Bool

    var body: some View {
        VStack(spacing: 28) {
            Spacer()
            VStack(spacing: 8) {
                Text("Absite")
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                Text("Who's studying?")
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 10) {
                ForEach(Auth.users) { user in
                    Button {
                        selected = user
                        passcode = ""
                        failed = false
                        passcodeFocused = true
                    } label: {
                        HStack {
                            Text(user.name).font(.headline)
                            Spacer()
                            Image(systemName: selected == user ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(selected == user ? Color.accentColor : Color.secondary)
                        }
                        .padding()
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                }
            }

            if selected != nil {
                VStack(spacing: 12) {
                    SecureField("Passcode", text: $passcode)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($passcodeFocused)
                        .submitLabel(.go)
                        .onSubmit(unlock)
                        .padding()
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                    if failed {
                        Text("Wrong passcode. Try again.")
                            .font(.footnote)
                            .foregroundStyle(Theme.bad)
                    }
                    Button(action: unlock) {
                        Text("Unlock").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(passcode.isEmpty)
                }
            }
            Spacer()
            Spacer()
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
    }

    private func unlock() {
        guard let user = selected else { return }
        if Auth.verify(user, passcode: passcode) {
            progress.load(user: user.name)
            session.login(user)
        } else {
            failed = true
            passcode = ""
        }
    }
}

#Preview {
    LoginView()
        .environment(Session())
        .environment(ProgressStore())
}
