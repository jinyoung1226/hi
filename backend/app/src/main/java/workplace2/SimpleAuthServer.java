package workplace2;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.mindrot.jbcrypt.BCrypt;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

// java.sql – 필요한 것만 명시
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.SQLIntegrityConstraintViolationException;
import java.sql.Statement;

// java.time
import java.time.Instant;
import java.time.temporal.ChronoUnit;

// java.util – 필요한 것만 명시 (Date는 여기서 import)
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;

/* 
순수 Java + HttpServer + MariaDB + 세션 + JWT 예제
 */
public class SimpleAuthServer {
    private static final ObjectMapper objectMapper = new ObjectMapper();

    // ==== DB CONFIG (환경에 맞게 수정) ==== //
    private static final String DB_URL = "jdbc:mariadb://localhost:3379/sql_db";
    private static final String DB_USER = "root";
    private static final String DB_PASSWORD = "SqlDba-1";

    // ==== JWT COOKIE 이름 ==== //
    private static final String JWT_COOKIE_NAME = "ACCESS_TOKEN";

    public static void main(String[] args) throws Exception {
        // JDBC 드라이버 로드
        Class.forName("org.mariadb.jdbc.Driver");

        UserRepository userRepository = new JdbcUserRepository(DB_URL, DB_USER, DB_PASSWORD);
        AuthService authService = new AuthService(userRepository);

        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);
        server.setExecutor(Executors.newFixedThreadPool(10));

        // GET /static/* -> CSS/JS
        server.createContext("/static", exchange -> {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                methodNotAllowed(exchange);
                return;
            }
            String path = exchange.getRequestURI().getPath(); // /static/style.css
            String filename = path.replaceFirst("/static/?", "");
            if (filename.isEmpty()) {
                notFound(exchange);
                return;
            }

            String resourcePath = "web/" + filename;
            String contentType;
            if (filename.endsWith(".css")) {
                contentType = "text/css; charset=utf-8";
            } else if (filename.endsWith(".js")) {
                contentType = "application/javascript; charset=utf-8";
            } else {
                contentType = "application/octet-stream";
            }
            serveResource(exchange, resourcePath, contentType);
        });

        // POST /api/signup -> 회원가입
        server.createContext("/api/auth/register", exchange -> {
            if (handleCors(exchange)) {
                return; 
            }

            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                methodNotAllowed(exchange);
                return;
            }
            
            Map<String, Object> body = objectMapper.readValue(exchange.getRequestBody(), Map.class);
            String username = (String) body.get("email");
            String password = (String) body.get("password");
            String authCode = (String) body.get("auth_code");


            if (isBlank(username) || isBlank(password)) {
                writeText(exchange, 400, "username and password are required");
                return;
            }

            try {
                authService.signUp(username, password);
                Map<String, Object> response = new HashMap<>();
                response.put("message", "회원가입이 완료되었습니다.");
                writeJson(exchange, 201, response);
            } catch (SQLIntegrityConstraintViolationException dup) {
                writeText(exchange, 400, "username already exists");
            } catch (Exception e) {
                e.printStackTrace();
                writeText(exchange, 500, "signup error");
            }
        });

        // POST /api/login
        // -> 로그인 + 세션 + JWT 발급 + 8008으로 직접 리다이렉트 테스트 완료
        // -> 로그인 + 세션 + JWT 발급 + 프론트엔드로 리다이렉트 처리
        server.createContext("/api/auth/login", exchange -> {
            if (handleCors(exchange)) {
                return; // Stop if it was a preflight OPTIONS request
            }
            // ---------------------------------

            System.out.println("Received /api/login request");

            Map<String, Object> body = objectMapper.readValue(exchange.getRequestBody(), Map.class);
            String username = (String) body.get("email");
            String password = (String) body.get("password");

            System.out.println("Login attempt for user: " + username + " with password: " + password);
            if (isBlank(username) || isBlank(password)) {
                writeText(exchange, 400, "username and password are required");
                return;
            }

            try {
                User user = authService.login(username, password);
                if (user == null) {
                    writeText(exchange, 401, "invalid credentials");
                    return;
                }

                // 2) JWT 생성 후 쿠키로 설정 (8008/8010 서버가 이 쿠키를 보고 검증)
                String jwt = JwtUtil.createToken(user);
                exchange.getResponseHeaders().add(
                        "Set-Cookie",
                        JWT_COOKIE_NAME + "=" + jwt + "; Path=/; HttpOnly; SameSite=Lax");

                // 3) Vue 프론트에서 "로그인 여부"를 판단하기 위한 일반 쿠키 (JS에서 읽기 가능)
                // - HttpOnly 를 붙이지 않는다
                // - Vue 의 authStore.checkAuthFromCookie() 에서 APP_AUTH 존재 여부로 로그인 여부를 판단
                exchange.getResponseHeaders().add(
                        "Set-Cookie",
                        "APP_AUTH=1; Path=/; SameSite=Lax"
                // 필요하면 Max-Age 도 추가 가능:
                // "APP_AUTH=1; Path=/; Max-Age=3600; SameSite=Lax"
                );

                Map<String, Object> response = new HashMap<>();
                response.put("access_token", jwt);
                response.put("user_name", user.getUsername());
                response.put("role", "ADMIN");
                writeJson(exchange, 200, response);
            } catch (Exception e) {
                e.printStackTrace();
                writeText(exchange, 500, "login error");
            }
        });

        // POST /api/logout -> 로그아웃
        server.createContext("/api/logout", exchange -> {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                methodNotAllowed(exchange);
                return;
            }
            // JWT 쿠키도 같이 제거 (선택)
            exchange.getResponseHeaders().add(
                    "Set-Cookie",
                    JWT_COOKIE_NAME + "=; Path=/; Max-Age=0;");

            redirect(exchange, "/login");
        });

        server.start();
        System.out.println("Server started at http://localhost:8080");
    }

    // ========= 리소스/응답 헬퍼 =========

    private static void serveResource(HttpExchange exchange, String resourcePath, String contentType)
            throws IOException {
        InputStream is = SimpleAuthServer.class.getClassLoader().getResourceAsStream(resourcePath);
        if (is == null) {
            notFound(exchange);
            return;
        }
        byte[] bytes = is.readAllBytes();
        exchange.getResponseHeaders().add("Content-Type", contentType);
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static void writeText(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "text/plain; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static void writeJson(HttpExchange exchange, int status, Object body) throws IOException {
        byte[] bytes = objectMapper.writeValueAsBytes(body);
        exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static void redirect(HttpExchange exchange, String location) throws IOException {
        exchange.getResponseHeaders().add("Location", location);
        exchange.sendResponseHeaders(302, -1);
        exchange.close();
    }

    private static void methodNotAllowed(HttpExchange exchange) throws IOException {
        writeText(exchange, 405, "Method Not Allowed");
    }

    private static void notFound(HttpExchange exchange) throws IOException {
        writeText(exchange, 404, "Not Found");
    }

    private static Map<String, String> parseFormBody(HttpExchange exchange) throws IOException {
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        Map<String, String> params = new HashMap<>();
        for (String pair : body.split("&")) {
            if (pair.isEmpty())
                continue;
            String[] kv = pair.split("=", 2);
            String key = urlDecode(kv[0]);
            String value = kv.length > 1 ? urlDecode(kv[1]) : "";
            params.put(key, value);
        }
        return params;
    }

    private static String urlDecode(String s) {
        return URLDecoder.decode(s, StandardCharsets.UTF_8);
    }

    private static boolean handleCors(HttpExchange exchange) throws IOException {
        // 1. Allow the specific Frontend URL
        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "http://localhost:8000");

        // 2. Allow methods (GET, POST, OPTIONS, etc.)
        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

        // 3. Allow headers (Content-Type is usually required for JSON/Forms)
        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type, Authorization");

        // 4. Allow Cookies (Crucial since you are setting JWT cookies)
        exchange.getResponseHeaders().add("Access-Control-Allow-Credentials", "true");

        // 5. Handle Preflight (OPTIONS) request immediately
        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            return true; // Signal that the request is handled
        }
        return false; // Signal to continue processing (for POST, GET, etc.)
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private static String escapeHtml(String s) {
        if (s == null)
            return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    // ========= 도메인 / 레포지토리 / 서비스 =========

    public static class User {
        private Long id;
        private String username;
        private String password;

        public Long getId() {
            return id;
        }

        public void setId(Long id) {
            this.id = id;
        }

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }
    }

    public interface UserRepository {
        void save(User user) throws Exception;

        User findByUsername(String username) throws Exception;
    }

    public static class JdbcUserRepository implements UserRepository {
        private final String url;
        private final String user;
        private final String password;

        public JdbcUserRepository(String url, String user, String password) {
            this.url = url;
            this.user = user;
            this.password = password;
        }

        private Connection getConnection() throws SQLException {
            return DriverManager.getConnection(url, user, password);
        }

        @Override
        public void save(User u) throws Exception {
            String sql = "INSERT INTO users(username, password) VALUES(?, ?)";
            try (Connection conn = getConnection();
                    PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, u.getUsername());
                ps.setString(2, u.getPassword());
                ps.executeUpdate();
                try (ResultSet rs = ps.getGeneratedKeys()) {
                    if (rs.next()) {
                        u.setId(rs.getLong(1));
                    }
                }
            }
        }

        @Override
        public User findByUsername(String username) throws Exception {
            String sql = "SELECT id, username, password FROM users WHERE username = ?";
            try (Connection conn = getConnection();
                    PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, username);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        User u = new User();
                        u.setId(rs.getLong("id"));
                        u.setUsername(rs.getString("username"));
                        u.setPassword(rs.getString("password"));
                        return u;
                    }
                }
            }
            return null;
        }
    }

    public static class AuthService {
        private final UserRepository userRepository;

        public AuthService(UserRepository userRepository) {
            this.userRepository = userRepository;
        }

        // 회원가입
        public void signUp(String username, String rawPassword) throws Exception {
            User existing = userRepository.findByUsername(username);
            if (existing != null) {
                throw new SQLIntegrityConstraintViolationException("username already exists");
            }

            // 비밀번호 해시
            String hashed = BCrypt.hashpw(rawPassword, BCrypt.gensalt(12));

            User u = new User();
            u.setUsername(username);
            u.setPassword(hashed); // 평문 대신 해시를 저장
            userRepository.save(u);
        }

        public User login(String username, String rawPassword) throws Exception {
            User u = userRepository.findByUsername(username);
            if (u == null) {
                return null; // 사용자 없음
            }

            // 해시 검증: rawPassword(입력값) vs u.getPassword()(DB 해시)
            if (!BCrypt.checkpw(rawPassword, u.getPassword())) {
                return null; // 비밀번호 불일치
            }

            return u; // 로그인 성공
        }
    }

    // ========= JWT 유틸 =========

    public static class JwtUtil {
        // 실제 서비스에서는 ENV나 설정 파일로 분리
        private static final String SECRET = "RANDOM_SECRET_KEY";
        // 임의의 비밀 문자열(시크릿 키)이며, 현재 코드에서는 HMAC256(대칭키 방식)에 쓰이는 공유 비밀키
        private static final Algorithm ALG = Algorithm.HMAC256(SECRET);
        private static final String ISSUER = "simple-auth-server";

        public static String createToken(User user) {
            Instant now = Instant.now();
            return JWT.create()
                    .withIssuer(ISSUER)
                    .withIssuedAt(Date.from(now))
                    .withExpiresAt(Date.from(now.plus(1, ChronoUnit.HOURS)))
                    .withSubject(String.valueOf(user.getId()))
                    .withClaim("username", user.getUsername())
                    .sign(ALG);
        }
    }
}

// 프로젝트 루트(app)에서 ./gradlew build 후 ./gradlew run 실행하여 JAVA를 이용하여 웹서버 및 인증 기능 빌드
// 배포 실행
// http://localhost:8080/login 브라우저에서 접속, 회원가입 → 로그인(인증) → /home 접근 확인
