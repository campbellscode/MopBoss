using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Text;
using MimeKit;

namespace MopBoss.Server.Tests.Support;

/// <summary>
/// A tiny in-process SMTP capture server on 127.0.0.1 (plain text, no TLS, no auth),
/// enough for MailKit to deliver to. Nothing leaves the machine.
/// </summary>
public sealed class FakeSmtpServer : IAsyncDisposable
{
    private readonly TcpListener _listener = new(IPAddress.Loopback, 0);
    private readonly CancellationTokenSource _stop = new();
    private readonly Task _accepting;

    public ConcurrentQueue<MimeMessage> Messages { get; } = new();
    public ConcurrentQueue<string> Recipients { get; } = new();

    /// <summary>Answer this many connections with 421 (service unavailable) before accepting mail.</summary>
    public int RefuseNextConnections;

    /// <summary>Reject every recipient with 550 (permanent).</summary>
    public bool RejectRecipients { get; set; }

    public int Port => ((IPEndPoint)_listener.LocalEndpoint).Port;

    public FakeSmtpServer()
    {
        _listener.Start();
        _accepting = AcceptLoopAsync();
    }

    private async Task AcceptLoopAsync()
    {
        while (!_stop.IsCancellationRequested)
        {
            TcpClient client;
            try { client = await _listener.AcceptTcpClientAsync(_stop.Token); }
            catch (OperationCanceledException) { return; }
            catch (ObjectDisposedException) { return; }
            _ = Task.Run(() => HandleAsync(client));
        }
    }

    private async Task HandleAsync(TcpClient client)
    {
        using var _ = client;
        var stream = client.GetStream();
        var reader = new StreamReader(stream, Encoding.ASCII);
        var writer = new StreamWriter(stream, Encoding.ASCII) { NewLine = "\r\n", AutoFlush = true };

        if (Interlocked.Decrement(ref RefuseNextConnections) >= 0)
        {
            await writer.WriteLineAsync("421 4.3.2 Service not available, try later");
            return;
        }

        await writer.WriteLineAsync("220 fake.smtp.test ESMTP");
        while (await reader.ReadLineAsync() is { } line)
        {
            var command = line.Length >= 4 ? line[..4].ToUpperInvariant() : line.ToUpperInvariant();
            switch (command)
            {
                case "EHLO":
                    await writer.WriteLineAsync("250-fake.smtp.test");
                    await writer.WriteLineAsync("250 8BITMIME");
                    break;
                case "HELO":
                case "MAIL":
                case "RSET":
                case "NOOP":
                    await writer.WriteLineAsync("250 OK");
                    break;
                case "RCPT":
                    if (RejectRecipients)
                    {
                        await writer.WriteLineAsync("550 5.1.1 Mailbox unavailable");
                    }
                    else
                    {
                        Recipients.Enqueue(line);
                        await writer.WriteLineAsync("250 OK");
                    }
                    break;
                case "DATA":
                    await writer.WriteLineAsync("354 End data with <CR><LF>.<CR><LF>");
                    var data = new StringBuilder();
                    while (await reader.ReadLineAsync() is { } dataLine && dataLine != ".")
                        data.Append(dataLine.StartsWith("..") ? dataLine[1..] : dataLine).Append("\r\n");
                    using (var ms = new MemoryStream(Encoding.UTF8.GetBytes(data.ToString())))
                        Messages.Enqueue(await MimeMessage.LoadAsync(ms));
                    await writer.WriteLineAsync("250 OK queued");
                    break;
                case "QUIT":
                    await writer.WriteLineAsync("221 Bye");
                    return;
                default:
                    await writer.WriteLineAsync("502 Command not implemented");
                    break;
            }
        }
    }

    public async ValueTask DisposeAsync()
    {
        _stop.Cancel();
        _listener.Stop();
        try { await _accepting; } catch { /* stopping */ }
        _stop.Dispose();
    }
}
